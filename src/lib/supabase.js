import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    process.env.VITE_SUPABASE_URL;
const supabaseKey =
    (typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key missing. Check .env file.');
}

// Fallback to avoid crash on init, though requests will fail
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
);
