
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Setup Clients
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing ENV variables. Make sure .env is loaded.");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function run() {
    console.log("1. Creating Test Users...");

    // User B (Receiver)
    const emailB = `receiver_${Date.now()}@test.com`;
    const { data: { user: userB }, error: errB } = await supabaseAdmin.auth.admin.createUser({
        email: emailB,
        password: 'password123',
        user_metadata: { role: 'tutor' },
        email_confirm: true
    });
    if (errB) { console.error("Failed User B", errB); return; }
    // Profile (Using standard table)
    await supabaseAdmin.from('profiles').insert({ id: userB.id, role: 'tutor', full_name: 'Receiver' });

    // User A (Sender)
    const emailA = `sender_${Date.now()}@test.com`;
    const { data: { user: userA }, error: errA } = await supabaseAdmin.auth.admin.createUser({
        email: emailA,
        password: 'password123',
        user_metadata: { role: 'student' },
        email_confirm: true
    });
    if (errA) { console.error("Failed User A", errA); return; }
    await supabaseAdmin.from('profiles').insert({ id: userA.id, role: 'student', full_name: 'Sender' });


    console.log("2. Sending Message A -> B...");
    // Create Conversation
    const { data: conv } = await supabaseAdmin.from('conversations').insert({}).select().single();
    await supabaseAdmin.from('conversation_members').insert([
        { conversation_id: conv.id, user_id: userA.id },
        { conversation_id: conv.id, user_id: userB.id }
    ]);

    // Send Message (Unread by default)
    // IMPORTANT: Verify that 'is_read' defaults to false
    await supabaseAdmin.from('messages').insert({
        conversation_id: conv.id,
        sender_id: userA.id,
        body: 'Hello Notification!',
        is_read: false
    });

    console.log("3. Checking Unread Count for User B (Replicating Logic)...");

    // LOGIC FROM messaging.js getUnreadCount
    // Step 1: Get my conversations
    const { data: myConvs } = await supabaseAdmin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userB.id);

    const convIds = myConvs.map(c => c.conversation_id);

    // Step 2: Count unread messages in these conversations sent by OTHERS
    const { count, error } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', userB.id)
        .eq('is_read', false);

    if (error) {
        console.error("Error getting unread count:", error);
    } else {
        console.log(`Unread Count for B: ${count}`);
        if (count === 1) console.log("PASS: Count is correct (1).");
        else console.error(`FAIL: Count should be 1, got ${count}`);
    }
}

run();
