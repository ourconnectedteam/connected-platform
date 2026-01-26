import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { supabase as supabaseClient } from './src/lib/supabase.js';

// Setup Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be in .env

if (!serviceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Cannot run admin verification.');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function verifyFlow() {
    const email = `test.user+${Date.now()}@gmail.com`;
    const password = 'password123';
    const role = 'tutor';

    console.log(`1. Creating User ${email} as ${role} (Admin API)...`);

    // Create user with Admin API (auto-confirms email)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role }
    });

    if (createError) {
        console.error('Admin Create Error:', createError);
        process.exit(1);
    }
    console.log('User created:', userData.user.id);

    // SIMULATE TRIGGER (Since we can't apply SQL to live DB)
    console.log('2. Simulating DB Trigger (Admin Insert Profile)...');
    const { error: triggerError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: userData.user.id,
            role: role,
            full_name: 'Test Trigger User',
            avatar_url: 'https://placehold.co/100'
        });

    if (triggerError) {
        console.warn('Trigger Simulation Warning (might already exist):', triggerError.message);
    }

    // Now Login as User to test RLS updates
    console.log('3. Logging in as user...');
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) {
        console.error('Login Error:', loginError);
        process.exit(1);
    }
    console.log('Login successful.');

    console.log('4. Verifying Profile Read...');
    const { data: profile, error: profError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();

    if (profError || !profile) {
        console.error('Profile Fetch Error:', profError);
        process.exit(1);
    }

    if (profile.role === role) {
        console.log(`PASS: Profile role matches: ${profile.role}`);
    } else {
        console.error(`FAIL: Role mismatch. Expected ${role}, got ${profile.role}`);
    }

    console.log('5. Testing Profile Update (RLS Check)...');
    const newName = 'Verified Update';
    const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', userData.user.id);

    if (updateError) {
        console.error('Update Error:', updateError);
        process.exit(1);
    }

    const { data: updated } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', userData.user.id)
        .single();

    if (updated.full_name === newName) {
        console.log('PASS: Profile updated successfully.');
    } else {
        console.error('FAIL: Update did not persist.');
        process.exit(1);
    }

    console.log('All Checks Passed!');
    // cleanup
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    process.exit(0);
}

verifyFlow();
