import { supabase } from './supabase.js';
import { logger } from './logger.js';

export const email = {
    /**
     * Sends a booking confirmation email.
     * @param {Object} bookingDetails - { studentName, providerName, date, time, link }
     */
    async sendBookingConfirmation(bookingDetails) {
        logger.debug('📧 Sending Booking Confirmation Email...', bookingDetails);

        // In a real production environment, we would call the Edge Function:
        /*
        const { error } = await supabase.functions.invoke('send-email', {
            body: {
                type: 'booking_confirmation',
                payload: bookingDetails
            }
        });
        if (error) throw error;
        */

        // SIMULATION: delay to mimic network request
        await new Promise(resolve => setTimeout(resolve, 800));
        logger.debug('✅ Email Sent Successfully (Simulated)');

        return { success: true };
    },

    /**
     * Sends a welcome email (e.g. after sign up).
     * @param {Object} userDetails - { email, name }
     */
    async sendWelcomeEmail(userDetails) {
        logger.debug('📧 Sending Welcome Email...', userDetails);
        // Simulation
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
    },
};
