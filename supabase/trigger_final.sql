-- FINAL FIX: Profile Creation Trigger
-- Ensures case-insensitive role handling and proper error swallowing.

-- 1. Ensure extensions exist
create extension if not exists "uuid-ossp";

-- 2. Clean up old artifacts
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 3. Define robust function
create or replace function public.handle_new_user()
returns trigger as $$
declare
  -- Default to student if anything goes wrong with extraction
  valid_role user_role := 'student';
  raw_role text;
begin
  -- Attempt to get role from metadata, safely handling nulls
  begin
    raw_role := new.raw_user_meta_data->>'role';
    -- Check if valid enum value (simple check, or just let cast handle it)
    if raw_role is not null then
       -- Normalize to lowercase to match enum ('Student' -> 'student')
       valid_role := lower(raw_role)::user_role;
    end if;
  exception when others then
    -- If casting fails (e.g. invalid string), keep default 'student'
    valid_role := 'student';
  end;

  -- Insert profile
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'User'),
    valid_role,
    'https://ui-avatars.com/api/?name=' || coalesce(new.email, 'User') || '&background=random'
  );

  return new;
exception when others then
  -- Fail safe: Log warning but allow user creation to proceed
  raise warning 'Profile creation trigger failed for user %: %', new.id, SQLERRM;
  return new;
end;
$$ language plpgsql security definer;

-- 4. Re-attach trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
