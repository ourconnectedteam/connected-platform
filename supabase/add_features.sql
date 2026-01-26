-- 1. Create Saved Users Table
create table if not exists public.saved_users (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null, -- The user performing the save
  saved_profile_id uuid references public.profiles(id) not null, -- The profile being saved
  created_at timestamp with time zone default now(),
  unique(user_id, saved_profile_id)
);

-- RLS for Saved Users
alter table public.saved_users enable row level security;

create policy "Users can view their own saved profiles"
  on public.saved_users for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved profiles"
  on public.saved_users for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved profiles"
  on public.saved_users for delete
  using (auth.uid() = user_id);

-- 2. Add Highlights and Video URL to Profiles
alter table public.profiles 
add column if not exists highlights jsonb default '[]'::jsonb,
add column if not exists introduction_video_url text;

-- 3. Create Storage Bucket for Videos (if not exists)
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "Videos are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'videos' );

create policy "Users can upload their own videos"
  on storage.objects for insert
  with check ( bucket_id = 'videos' and auth.uid() = owner );

create policy "Users can update their own videos"
  on storage.objects for update
  using ( bucket_id = 'videos' and auth.uid() = owner );
