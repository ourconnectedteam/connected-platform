// Seed script to be run with node (requires type module in package.json or .mjs)
// Usage: node src/scripts/seed.js (ensure .env variables are set)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service key to bypass RLS/Auth

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const mockUsers = [
    {
        email: 'james@connected.com',
        password: 'password123',
        profile: {
            full_name: 'James Wilson',
            role: 'tutor',
            bio: 'Oxford math graduate with 5 years experience.',
            hourly_rate: 55,
            subjects: ['Math AA', 'Physics'],
            verified: true
        }
    },
    {
        email: 'maria@connected.com',
        password: 'password123',
        profile: {
            full_name: 'Maria Fernandez',
            role: 'counselor',
            bio: 'Ex-Harvard admissions officer.',
            hourly_rate: 120,
            specialties: ['US Admissions', 'Ivy League'],
            verified: true
        }
    },
    {
        email: 'alex@student.com',
        password: 'password123',
        profile: {
            full_name: 'Alex Chen',
            role: 'student',
            bio: 'IB Year 2 student looking for study group.',
            ib_status: 'year2',
            ib_subjects: ['Math AA', 'Physics HL', 'Econ HL']
        }
    }
];

async function seed() {
    console.log('Starting seed...');

    for (const user of mockUsers) {
        let userId = null;
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true
        });

        if (authError) {
            console.error(`Error creating auth for ${user.email}:`, authError.message);
            // If user creation fails, try to find if the user already exists
            console.log(`User ${user.email} creation failed, attempting lookup...`);
            const { data, error } = await supabase.auth.admin.listUsers();
            if (error) {
                console.error('List users error:', error);
                continue; // Cannot proceed if listing users also fails
            }
            // console.log('Users found:', data.users.map(u => u.email)); // Uncomment to debug listed users
            const found = data.users.find(u => u.email === user.email);
            if (found) {
                userId = found.id;
                console.log(`Found existing user: ${user.email} (${userId})`);
            } else {
                console.error(`Could not find user ${user.email} in listUsers even though creation failed.`);
                continue; // Cannot proceed if user is not found
            }
        } else {
            userId = authUser.user.id;
            console.log(`Created auth user: ${user.email} (${userId})`);
        }

        if (!userId) {
            console.error(`Failed to get userId for ${user.email}. Skipping profile creation.`);
            continue;
        }

        // Create Profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: userId,
            full_name: user.profile.full_name,
            role: user.profile.role,
            bio: user.profile.bio,
            verified: user.profile.verified || false
        });

        if (profileError) console.error('Error creating profile:', profileError);

        // Create Role Specific Profile
        if (user.profile.role === 'tutor') {
            await supabase.from('tutor_profiles').insert({
                user_id: userId,
                hourly_rate: user.profile.hourly_rate,
                subjects: user.profile.subjects
            });

            // Add Availability Slots (Next 7 days)
            const slots = [];
            const today = new Date();
            for (let i = 1; i <= 7; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                // 10 AM
                const start1 = new Date(date); start1.setHours(10, 0, 0, 0);
                const end1 = new Date(date); end1.setHours(11, 0, 0, 0);

                // 2 PM
                const start2 = new Date(date); start2.setHours(14, 0, 0, 0);
                const end2 = new Date(date); end2.setHours(15, 0, 0, 0);

                slots.push({ provider_id: userId, start_time: start1, end_time: end1 });
                slots.push({ provider_id: userId, start_time: start2, end_time: end2 });
            }
            await supabase.from('availability_slots').insert(slots);

        } else if (user.profile.role === 'counselor') {
            await supabase.from('counselor_profiles').insert({
                user_id: userId,
                hourly_rate: user.profile.hourly_rate,
                specialties: user.profile.specialties
            });
            // Add similar slots if needed
        } else if (user.profile.role === 'student') {
            await supabase.from('student_profiles').insert({
                user_id: userId,
                ib_status: user.profile.ib_status,
                ib_subjects: user.profile.ib_subjects
            });
        }
    }

    console.log('Seed complete!');
}

seed();
