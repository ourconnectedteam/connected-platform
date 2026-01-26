import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlpldtuxesielraltddi.supabase.co';
const supabaseKey = 'sb_publishable_BY2zxo5gXf5JYtPSyBm0dw_b3WpZb6s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
    const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (error) {
        console.error(`Error querying ${tableName}:`, error.message);
        return;
    }
    console.log(`${tableName}: ${count} rows`);
}

async function checkData() {
    console.log('Checking Supabase Tables...');
    await checkTable('profiles');
    await checkTable('tutor_profiles');
    await checkTable('counselor_profiles');
    await checkTable('student_profiles');

    // Test App Query for Tutors
    const { data: appTutors, error: appError } = await supabase.from('tutor_profiles').select('*, profiles(*)');
    if (appError) {
        console.error('App Query Tutor Error:', appError);
    } else {
        console.log('App Query Tutors Found:', appTutors.length);
        if (appTutors.length > 0) console.log('First Tutor:', JSON.stringify(appTutors[0], null, 2));
    }

    // Test App Query for Students
    const { data: appStudents, error: appStudentError } = await supabase.from('student_profiles').select('*, profiles(*)');
    if (appStudentError) {
        console.error('App Query Student Error:', appStudentError);
    } else {
        console.log('App Query Students Found:', appStudents.length);
        if (appStudents.length > 0) console.log('First Student:', JSON.stringify(appStudents[0], null, 2));
    }
}

checkData();
