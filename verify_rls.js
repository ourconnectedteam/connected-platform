
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRLS() {
    console.log("Verifying anonymous access to profiles...");

    // 1. Try to fetch ANY profile (anonymous)
    const { data, error } = await supabase.from('profiles').select('*').limit(1);

    if (error) {
        console.error("❌ Anonymous SELECT failed on 'profiles':", error.message);
        console.error("This confirms RLS is blocking public access.");
    } else {
        console.log("✅ Anonymous SELECT succeeded on 'profiles'. Count:", data.length);
    }

    // 2. Try specific profile if known (grab one from Step 1 if available)
    if (data && data.length > 0) {
        const id = data[0].id;
        const { data: single, error: singleErr } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (singleErr) {
            console.error("❌ Single fetch failed even though list worked:", singleErr.message);
        } else {
            console.log("✅ Single fetch worked.");
        }
    }
}

verifyRLS();
