-- Add columns to role specific tables if they don't exist

-- Student
alter table public.student_profiles 
add column if not exists grade_level text,
add column if not exists academic_interests text[];

-- Tutor
alter table public.tutor_profiles
add column if not exists subjects text[],
add column if not exists hourly_rate numeric,
add column if not exists years_experience integer,
add column if not exists is_remote boolean default true;

-- Counselor
alter table public.counselor_profiles
add column if not exists specialization text[], -- e.g. ["College Prep", "Career"]
add column if not exists years_experience integer,
add column if not exists certifications text[];
