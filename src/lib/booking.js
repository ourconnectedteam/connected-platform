import { supabase } from './supabase.js';
import { auth } from './auth.js';

export const booking = {
    // Get Slots for a Provider
    async getSlots(providerId) {
        const { data, error } = await supabase
            .from('availability_slots')
            .select('*')
            .eq('provider_id', providerId)
            .eq('is_booked', false)
            .gte('start_time', new Date().toISOString())
            .order('start_time');
        return { data, error };
    },

    // Create Booking
    async createBooking(details) {
        // details: { student_id, provider_id, slot_id, notes, ... }

        // 1. Mark Slot as Booked (Optimistic)
        // In real app, use a transaction or RPC to prevent double booking
        // Here we just update
        if (details.slot_id) {
            await supabase.from('availability_slots')
                .update({ is_booked: true })
                .eq('id', details.slot_id);
        }

        // 2. Create Booking Record
        const { data, error } = await supabase.from('bookings').insert({
            student_id: details.student_id,
            provider_id: details.provider_id,
            status: 'pending_payment',
            scheduled_start: details.scheduled_start,
            scheduled_end: details.scheduled_end,
            price_total: details.price,
            notes: details.notes
        }).select().single();

        return { data, error };
    },

    // Process Payment (Simulator)
    async processPayment(bookingId) {
        // Call Stripe here in real app
        // supabase.functions.invoke('create-checkout', { body: { bookingId } })

        // Simulating success for now
        return { sessionUrl: 'https://checkout.stripe.com/mock-session' };
    }
};
