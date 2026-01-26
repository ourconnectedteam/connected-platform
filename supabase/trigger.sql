
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
