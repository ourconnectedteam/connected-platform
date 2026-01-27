import { supabase } from './supabase.js';

// Cache counts in memory for page lifecycle
let countsCache = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch profile counts for all roles from the database
 * Results are cached for 5 minutes to avoid redundant queries
 */
export async function getProfileCounts() {
    // Return cached data if still valid
    if (countsCache && cacheTime && Date.now() - cacheTime < CACHE_DURATION) {
        return countsCache;
    }

    try {
        // Fetch counts using COUNT queries (efficient - no data transfer)
        const [tutorsResult, counselorsResult, studentsResult] = await Promise.all([
            supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'tutor'),
            supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'counselor'),
            supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'student'),
        ]);

        const counts = {
            tutors: tutorsResult.count || 0,
            counselors: counselorsResult.count || 0,
            students: studentsResult.count || 0,
        };

        // Cache results
        countsCache = counts;
        cacheTime = Date.now();

        return counts;
    } catch (error) {
        console.error('Error fetching profile counts:', error);
        // Return zeros on error (graceful degradation)
        return { tutors: 0, counselors: 0, students: 0 };
    }
}
