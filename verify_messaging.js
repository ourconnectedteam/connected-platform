import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { messaging } from './src/lib/messaging.js';
import { supabase as supabaseClient } from './src/lib/supabase.js';

// Setup Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function verifyMessaging() {
    console.log('1. Creating Test Users...');
    const emailA = `userA+${Date.now()}@test.com`;
    const emailB = `userB+${Date.now()}@test.com`;

    const { data: userA, error: errA } = await supabaseAdmin.auth.admin.createUser({
        email: emailA,
        password: 'password123',
        email_confirm: true,
        user_metadata: { role: 'student' }
    });
    const { data: userB, error: errB } = await supabaseAdmin.auth.admin.createUser({
        email: emailB,
        password: 'password123',
        email_confirm: true,
        user_metadata: { role: 'tutor' }
    });

    if (errA || errB) {
        console.error('Create User Error (Check Trigger):', errA, errB);
        process.exit(1);
    }

    // ENSURE PROFILES EXIST (Robustness against trigger failure)
    const ensureProfile = async (u, role) => {
        const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', u.user.id).single();
        if (!data) {
            console.log(`Trigger failed for ${role}, manually inserting profile...`);
            await supabaseAdmin.from('profiles').insert({
                id: u.user.id,
                full_name: role === 'student' ? 'User A' : 'User B',
                role: role,
                avatar_url: 'https://placehold.co/100'
            });
        }
    };

    await ensureProfile(userA, 'student');
    await ensureProfile(userB, 'tutor');

    console.log('2. Starting Conversation (A -> B)...');
    const { data: conv, error: startError } = await messaging.startConversation(userA.user.id, userB.user.id);

    if (startError) {
        console.error('Start Error:', startError);
        process.exit(1);
    }
    console.log('Conversation Started:', conv.id);

    console.log('3. Sending Message (A -> B)...');
    const { data: msg, error: msgError } = await messaging.sendMessage(conv.id, userA.user.id, 'Hello from User A');

    if (msgError) {
        console.error('Send Check Error:', msgError);
        process.exit(1);
    }
    console.log('Message Sent:', msg.body);

    console.log('4. Verifying Messages (Read by B)...');
    const { data: msgs, error: getError } = await messaging.getMessages(conv.id);
    if (getError || msgs.length !== 1) {
        console.error('Get Messages Error or Count Mismatch:', getError, msgs?.length);
        process.exit(1);
    }

    if (msgs[0].body === 'Hello from User A') {
        console.log('PASS: Message verification successful.');
    } else {
        console.error('FAIL: Message body mismatch');
        process.exit(1);
    }

    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(userA.user.id);
    await supabaseAdmin.auth.admin.deleteUser(userB.user.id);
    process.exit(0);
}

verifyMessaging();
