import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlpldtuxesielraltddi.supabase.co';
const supabaseKey = 'sb_publishable_BY2zxo5gXf5JYtPSyBm0dw_b3WpZb6s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBookingSubmission() {
    const email = 'test_booking_1768310891602@test.com';
    const password = 'password123';

    console.log('1. Logging in...');
    const { data: { user, session }, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) {
        console.error('Login Failed:', loginError.message);
        return;
    }
    console.log('Login Successful:', user.id);

    console.log('2. Finding a slot...');
    const { data: slots } = await supabase.from('availability_slots')
        .select('*')
        .eq('is_booked', false)
        .gt('start_time', new Date().toISOString())
        .limit(1);

    if (!slots || slots.length === 0) {
        console.error('No slots available for testing.');
        return;
    }
    const slot = slots[0];
    console.log('Found slot:', slot.id);

    console.log('3. Creating Booking...');
    const bookingData = {
        student_id: user.id,
        provider_id: slot.provider_id,
        status: 'pending_payment',
        scheduled_start: slot.start_time,
        scheduled_end: new Date(new Date(slot.start_time).getTime() + 60 * 60 * 1000).toISOString(),
        price_total: 50,
        notes: 'Automated Test Booking'
    };

    const { data: booking, error: bookingError } = await supabase.from('bookings').insert(bookingData).select().single();

    if (bookingError) {
        console.error('Booking Creation Failed:', bookingError.message);
    } else {
        console.log('Booking Created Successfully:', booking.id);

        // Cleanup (Optional, but good for repeatability if we want to reuse slot? Actually let's leave it to verify in dashboard)
        // await supabase.from('bookings').delete().eq('id', booking.id);
    }
}

testBookingSubmission();
