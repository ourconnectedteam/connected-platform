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
        const parseTime = str => {
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
                                is_booked: false,
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
            await supabase
                .from('availability_slots')
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
            await supabase.from('availability_slots').update({ is_booked: true }).in('id', slotIds);
        }

        // 2. Create Booking Record
        // Status: 'pending_approval' (Wait for tutor) -> 'approved_pending_payment' (Wait for student) -> 'confirmed'
        const { data, error } = await supabase
            .from('bookings')
            .insert({
                student_id: details.student_id,
                provider_id: details.provider_id,
                status: 'pending_approval',
                scheduled_start: details.scheduled_start,
                scheduled_end: details.scheduled_end,
                price_total: details.price,
                notes: details.notes,
            })
            .select()
            .single();

        return { data, error };
    },

    // Approve Booking (Tutor Side)
    async approveBooking(bookingId) {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'approved_pending_payment' })
            .eq('id', bookingId)
            .select()
            .single();
        return { data, error };
    },

    // Reject Booking (Tutor Side)
    async rejectBooking(bookingId) {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'rejected' })
            .eq('id', bookingId)
            .select()
            .single();
        return { data, error };
    },

    // Complete Payment (Student Side)
    async completePayment(bookingId) {
        // 1. Get booking details to find slots
        const { data: bookingData, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (fetchError) return { error: fetchError };

        // 2. Mark slots as Booked
        // We find slots for this provider in this time range
        const { error: slotError } = await supabase
            .from('availability_slots')
            .update({ is_booked: true })
            .eq('provider_id', bookingData.provider_id)
            .gte('start_time', bookingData.scheduled_start)
            .lt('start_time', bookingData.scheduled_end);

        if (slotError) console.error('Error updating slots:', slotError);

        // 3. Update Booking Status
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'confirmed' }) // Payment successful
            .eq('id', bookingId)
            .select()
            .single();
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
        this.stripe = await Stripe(
            'pk_test_51SpXtuRyje2bzRMJQsYZUcCo5zWLxfxc3AzWXr1vjUKilaJd3EnXpogRHHK3EFdzqP8ngcngAne2ZlLjrqbxSOx100MUujp74A'
        );
        return this.stripe;
    },

    // Create Payment Intent (Client-side mock for demo purposes if backend not ready)
    async createPaymentIntent(amount) {
        console.warn('Using MOCK Payment Intent.');
        return 'mock_secret_client_demo';
    },

    // Get Slots For Range (Calendar View)
    async getSlotsForRange(providerId, startTime, endTime) {
        const { data, error } = await supabase
            .from('availability_slots')
            .select('*')
            .eq('provider_id', providerId)
            .gte('start_time', startTime)
            .lt('start_time', endTime);
        return { data, error };
    },

    // Update Slots For Range
    // This syncs the frontend "Active" set with the DB for a specific week
    async updateSlotsForRange(providerId, startTime, endTime, activeSlots) {
        // activeSlots: Array of { start_time, end_time } that MUST exist

        // 1. Fetch current existing slots in this range
        const { data: existing, error: fetchError } = await this.getSlotsForRange(
            providerId,
            startTime,
            endTime
        );
        if (fetchError) return { error: fetchError };

        // 2. Identify Deltas
        // A. Slots to DELETE: Exist in DB but NOT in activeSlots (and NOT booked)
        // B. Slots to INSERT: In activeSlots but NOT in DB

        const existingMap = new Set(existing.map(s => new Date(s.start_time).toISOString()));
        const activeMap = new Set(activeSlots.map(s => new Date(s.start_time).toISOString()));

        // Delete candidates
        const toDeleteIds = existing
            .filter(s => !activeMap.has(new Date(s.start_time).toISOString())) // Not in new set
            .filter(s => !s.is_booked) // DO NOT delete booked slots
            .map(s => s.id);

        // Insert candidates
        const toInsert = activeSlots
            .filter(s => !existingMap.has(new Date(s.start_time).toISOString()))
            .map(s => ({
                provider_id: providerId,
                start_time: s.start_time,
                end_time: s.end_time,
                is_booked: false,
            }));

        // Execute
        if (toDeleteIds.length > 0) {
            await supabase.from('availability_slots').delete().in('id', toDeleteIds);
        }

        if (toInsert.length > 0) {
            await supabase.from('availability_slots').insert(toInsert);
        }

        return { success: true, added: toInsert.length, removed: toDeleteIds.length };
    },

    // Create Booking

    // Cancel Booking
    async cancelBooking(bookingId) {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId)
            .select()
            .single();

        return { data, error };
    },

    // Submit Review
    async submitReview(reviewData) {
        // reviewData: { booking_id, reviewer_id, reviewee_id, rating, comment }
        const { data, error } = await supabase.from('reviews').insert(reviewData).select().single();
        return { data, error };
    },

    // Delete Booking (Cleanup/Trash)
    async deleteBooking(bookingId) {
        const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
        return { error };
    },
};
