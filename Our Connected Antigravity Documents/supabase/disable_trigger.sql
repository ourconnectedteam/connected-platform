-- DISABLE TRIGGER
-- The trigger is causing persistent 500 errors. We are reverting to manual profile creation.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
