import { supabase } from './supabase.js';

/**
 * Fetch all profile stats in batch queries
 * @param {string} profileId - The user ID to fetch stats for
 * @param {string} role - The user's role (tutor/counselor/student)
 * @returns {Promise<Object>} - Stats object with all metrics
 */
export async function getProfileStats(profileId, role) {
    try {
        const now = new Date();
        const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        // Batch all queries in parallel
        const [reviewsResult, lessonsResult, bookings48hResult, connections48hResult] =
            await Promise.all([
                // 1. Reviews: fetch all ratings to compute average
                supabase.from('reviews').select('rating').eq('reviewee_id', profileId),

                // 2. Total lessons (completed bookings where user was provider or student)
                supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .eq(role === 'student' ? 'student_id' : 'provider_id', profileId)
                    .eq('status', 'completed'),

                // 3. Bookings in last 48 hours
                supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .eq(role === 'student' ? 'student_id' : 'provider_id', profileId)
                    .gte('created_at', last48h.toISOString()),

                // 4. New connections in last 48 hours
                supabase
                    .from('connections')
                    .select('id', { count: 'exact', head: true })
                    .or(`user_a.eq.${profileId},user_b.eq.${profileId}`)
                    .gte('created_at', last48h.toISOString()),
            ]);

        // Compute rating average and count
        const ratings = reviewsResult.data || [];
        const avgRating =
            ratings.length > 0
                ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
                : null;
        const reviewCount = ratings.length;

        return {
            rating: avgRating,
            reviewCount: reviewCount,
            lessonsCount: lessonsResult.count || 0,
            bookings48h: bookings48hResult.count || 0,
            connections48h: connections48hResult.count || 0,
            // Response time not implemented (too complex for initial version)
            responseTime: null,
        };
    } catch (error) {
        console.error('Error fetching profile stats:', error);
        // Return null values for graceful fallback
        return {
            rating: null,
            reviewCount: 0,
            lessonsCount: 0,
            bookings48h: 0,
            connections48h: 0,
            responseTime: null,
        };
    }
}
