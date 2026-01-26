import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlpldtuxesielraltddi.supabase.co';
// Using Service Role Key to bypass email verification
const supabaseServiceKey = 'sb_secret_KGceDgf4pnJQofcJpRU5aQ_Zz1MapLR';
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createVerifiedUser() {
    const email = `test_booking_${Date.now()}@test.com`;
    const password = 'password123';

    console.log(`Creating verified user: ${email}`);

    const { data: user, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: 'Test Student' }
    });

    if (error) {
        console.error('Error creating user:', error);
        return null;
    }

    console.log('User created successfully:', user.user.id);

    // Also insert into public.profiles if triggers don't handle it
    // Usually triggers might handle it, but with admin.createUser sometimes they don't fire the same way or RLS might block if we didn't have service key.
    // Since we have service key, we can write directly to profiles if needed.
    // Let's check if profile exists first.

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.user.id).single();

    if (!profile) {
        console.log('Profile missing, inserting manually...');
        const { error: profileError } = await supabase.from('profiles').insert({
            id: user.user.id,
            full_name: 'Test Student',
            role: 'student', // default
            created_at: new Date().toISOString()
        });
        if (profileError) console.error('Error creating profile:', profileError);
        else console.log('Profile created.');
    } else {
        console.log('Profile already exists via trigger.');
    }

    return { email, password };
}

createVerifiedUser();
