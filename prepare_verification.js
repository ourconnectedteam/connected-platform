import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlpldtuxesielraltddi.supabase.co';
const supabaseKey = 'sb_publishable_BY2zxo5gXf5JYtPSyBm0dw_b3WpZb6s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndPrepare() {
    console.log('--- Checking Tutors ---');
    const { data: tutors } = await supabase.from('tutor_profiles').select('*').limit(1);
    if (!tutors || tutors.length === 0) {
        console.error('No tutors found!');
        return;
    }
    const tutorId = tutors[0].user_id;
    console.log('Target Tutor ID:', tutorId);

    console.log('--- Checking Slots ---');
    // Check for slots in the future
    const { data: slots } = await supabase.from('availability_slots')
        .select('*')
        .eq('provider_id', tutorId)
        .gte('start_time', new Date().toISOString());

    if (!slots || slots.length === 0) {
        console.log('No future slots found. Creating a test slot...');
        // Create a slot for tomorrow at 10:00 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const { data: newSlot, error } = await supabase.from('availability_slots').insert({
            provider_id: tutorId,
            start_time: tomorrow.toISOString(),
            is_booked: false
        }).select().single();

        if (error) {
            console.error('Error creating slot:', error);
        } else {
            console.log('Created test slot:', newSlot.id);
        }
    } else {
        console.log(`Found ${slots.length} available slots.`);
        console.log('First slot ID:', slots[0].id);
    }

    console.log('--- Checking Existing Bookings ---');
    const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    console.log('Total bookings count:', count);
}

checkAndPrepare();
