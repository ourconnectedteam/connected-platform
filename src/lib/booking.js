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

    // Set Availability (Batch Create Slots)
    async setAvailability(providerId, schedule) {
        // schedule: { 'Mon': ['09:00-12:00', '14:00-17:00'], 'Tue': ... }
        // Generate slots for next 4 weeks

        const slots = [];
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 28); // 4 weeks

        // Helper to parse time string "09:00" -> {h, m}
        const parseTime = (str) => {
            const [h, m] = str.split(':').map(Number);
            return { h, m };
        };

        // Iterate dates
        for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon", "Tue"

            if (schedule[dayName]) {
                schedule[dayName].forEach(range => {
                    const [startStr, endStr] = range.split('-');
                    const start = parseTime(startStr);
                    const end = parseTime(endStr);

                    // Create Date objects for this range
                    const startTime = new Date(d);
                    startTime.setHours(start.h, start.m, 0, 0);

                    const endTime = new Date(d);
                    endTime.setHours(end.h, end.m, 0, 0);

                    // Generate 30 min slots
                    let temp = new Date(startTime);
                    while (temp < endTime) {
                        const slotStart = new Date(temp);
                        const slotEnd = new Date(temp.getTime() + 30 * 60000); // +30 mins

                        // Don't add if past current time
                        if (slotStart > new Date()) {
                            slots.push({
                                provider_id: providerId,
                                start_time: slotStart.toISOString(),
                                end_time: slotEnd.toISOString(),
                                is_booked: false
                            });
                        }
                        temp = slotEnd;
                    }
                });
            }
        }

        // Batch Insert
        if (slots.length > 0) {
            // First, clear existing future unbooked slots to avoid duplicates?
            // Real app: careful sync. Demo: Clear all unbooked future slots for this provider
            await supabase.from('availability_slots')
                .delete()
                .eq('provider_id', providerId)
                .eq('is_booked', false)
                .gte('start_time', new Date().toISOString());

            const { data, error } = await supabase.from('availability_slots').insert(slots);
            return { count: slots.length, error };
        }

        return { count: 0 };
    },

    // Create Booking
    async createBooking(details) {
        // details: { student_id, provider_id, slot_id, notes, ... }

        // 1. Mark Slot as Booked (Optimistic)
        // In real app, use a transaction or RPC to prevent double booking
        // Here we just update
        // 1. Mark Slot(s) as Booked (Optimistic)
        // In real app, use a transaction or RPC to prevent double booking
        // Here we just update
        const slotIds = details.slot_ids || (details.slot_id ? [details.slot_id] : []);

        if (slotIds.length > 0) {
            await supabase.from('availability_slots')
                .update({ is_booked: true })
                .in('id', slotIds);
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
    },

    // Stripe Integration
    stripe: null,

    async initStripe() {
        if (this.stripe) return this.stripe;
        // REPLACE WITH YOUR PUBLISHABLE KEY
        this.stripe = await Stripe('pk_test_51SpXtuRyje2bzRMJQsYZUcCo5zWLxfxc3AzWXr1vjUKilaJd3EnXpogRHHK3EFdzqP8ngcngAne2ZlLjrqbxSOx100MUujp74A');
        return this.stripe;
    },

    // Create Payment Intent (Client-side mock for demo purposes if backend not ready)
    // In production, this MUST be a call to Supabase Edge Function
    async createPaymentIntent(amount) {
        // Return a mock result since we don't have a backend function running yet
        // In a real flow:
        // const { data, error } = await supabase.functions.invoke('create-payment-intent', { body: { amount } });
        // return data.clientSecret;

        console.warn('Using MOCK Payment Intent. Payments will not be processed by Stripe real servers.');
        return 'mock_secret_client_demo';
    },

    async confirmPayment(elements) {
        if (!this.stripe) await this.initStripe();

        // In real flow:
        // const result = await this.stripe.confirmPayment({
        //    elements,
        //    confirmParams: { return_url: window.location.origin + '/booking-success' },
        //    redirect: 'if_required' 
        // });

        // Mocking Success for Demo
        return { paymentIntent: { status: 'succeeded' } };
    },

    // Cancel Booking
    async cancelBooking(bookingId) {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId)
            .select()
            .single();

        // Also free up the slot?
        // In a real app we would want to free the slot in 'availability_slots'
        // But we need the slot_id from the booking first or a trigger.
        // For now, let's just mark booking as cancelled.

        return { data, error };
    }
};
