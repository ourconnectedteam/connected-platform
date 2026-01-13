-- FIX: Safer Trigger Function
-- Replaces the previous trigger with one that handles potential nulls and casting errors.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role user_role := 'student';
  meta_role text;
begin
  -- Safely extract role from metadata
  begin
    meta_role := new.raw_user_meta_data->>'role';
  exception when others then
    meta_role := null;
  end;

  -- Default if null
  if meta_role is null then
    meta_role := 'student';
  end if;

  -- Insert profile
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'User'), -- Handle potential null email
    meta_role::user_role, -- Assumes 'student', 'tutor', 'counselor' are valid enum values
    'https://ui-avatars.com/api/?name=' || coalesce(new.email, 'User') || '&background=random'
  );
  
  return new;
exception when others then
    -- IMPORTANT: Swallowing errors to prevent blocking Sign Up, 
    -- but ideally we should log this. 
    -- For this MVP, if profile creation fails, we allow user creation 
    -- so they can at least login (and maybe fix profile later).
    raise warning 'Profile creation failed for user %: %', new.id, SQLERRM;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
