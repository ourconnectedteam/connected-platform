import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSlots() {
    const { count, error } = await supabase
        .from('availability_slots')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error checking slots:', error);
    } else {
        console.log(`Found ${count} total availability slots.`);
    }
}

checkSlots();
