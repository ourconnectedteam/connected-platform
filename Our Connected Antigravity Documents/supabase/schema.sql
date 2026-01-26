-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Extends auth.users)
create type user_role as enum ('student', 'tutor', 'counselor');

create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  avatar_url text,
  role user_role not null,
  bio text,
  timezone text default 'Europe/Madrid',
  location text,
  languages text[],
  verified boolean default false,
  onboarding_complete boolean default false,
  connections_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- STUDENT PROFILES
create table public.student_profiles (
  user_id uuid references public.profiles(id) primary key,
  ib_status text, -- 'year1', 'year2', 'alumni'
  ib_subjects text[],
  target_universities text[],
  interests text[]
);

-- TUTOR PROFILES
create table public.tutor_profiles (
  user_id uuid references public.profiles(id) primary key,
  subjects text[],
  levels text[], -- ['SL', 'HL']
  hourly_rate int,
  session_durations int[], -- [60, 90]
  availability_rules jsonb,
  calendar_link text,
  rating_avg numeric(3,2) default 0,
  rating_count int default 0
);

-- COUNSELOR PROFILES
create table public.counselor_profiles (
  user_id uuid references public.profiles(id) primary key,
  specialties text[],
  hourly_rate int,
  session_durations int[],
  availability_rules jsonb,
  rating_avg numeric(3,2) default 0,
  rating_count int default 0
);

-- AVAILABILITY SLOTS
create table public.availability_slots (
  id uuid default uuid_generate_v4() primary key,
  provider_id uuid references public.profiles(id) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  is_booked boolean default false,
  created_at timestamp with time zone default now()
);

-- BOOKINGS
create type booking_status as enum ('pending_payment', 'confirmed', 'cancelled', 'completed', 'refunded');

create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.profiles(id) not null,
  provider_id uuid references public.profiles(id) not null,
  status booking_status default 'pending_payment',
  session_type text default 'online',
  duration_minutes int,
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  notes text,
  price_total int,
  currency text default 'USD',
  payment_status text default 'unpaid',
  stripe_session_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- MESSAGING
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  last_message_at timestamp with time zone default now()
);

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  last_read_at timestamp with time zone default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) not null,
  body text,
  created_at timestamp with time zone default now()
);

-- SOCIAL / CONNECTIONS
create table public.connection_requests (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id) not null,
  status text default 'pending', -- pending, accepted, declined
  created_at timestamp with time zone default now(),
  unique(requester_id, receiver_id)
);

create table public.connections (
  id uuid default uuid_generate_v4() primary key,
  user_a uuid references public.profiles(id) not null,
  user_b uuid references public.profiles(id) not null,
  created_at timestamp with time zone default now(),
  unique(user_a, user_b) -- Ensure A < B logic in app or trigger
);

-- RLS POLICIES (Simplified for initial setup)
alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

alter table student_profiles enable row level security;
create policy "Public student profiles" on student_profiles for select using (true);
create policy "Update own student profile" on student_profiles for update using (auth.uid() = user_id);

alter table tutor_profiles enable row level security;
create policy "Public tutor profiles" on tutor_profiles for select using (true);
create policy "Update own tutor profile" on tutor_profiles for update using (auth.uid() = user_id);

alter table counselor_profiles enable row level security;
create policy "Public counselor profiles" on counselor_profiles for select using (true);
create policy "Update own counselor profile" on counselor_profiles for update using (auth.uid() = user_id);

-- Add more specific policies for bookings/messages as needed

-- TRIGGER: Handle New User
-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    'https://ui-avatars.com/api/?name=' || new.email || '&background=random'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
