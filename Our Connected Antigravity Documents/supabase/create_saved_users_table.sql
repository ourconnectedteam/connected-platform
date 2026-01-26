-- Create saved_users table
create table if not exists public.saved_users (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  saved_profile_id uuid references public.profiles(id) not null,
  created_at timestamp with time zone default now(),
  unique(user_id, saved_profile_id)
);

-- Enable RLS
alter table public.saved_users enable row level security;

-- Policies
create policy "Users can view their own saved profiles" 
  on public.saved_users for select 
  using (auth.uid() = user_id);

create policy "Users can save profiles" 
  on public.saved_users for insert 
  with check (auth.uid() = user_id);

create policy "Users can unsave profiles" 
  on public.saved_users for delete 
  using (auth.uid() = user_id);
