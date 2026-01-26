-- DANGER: This script will DELETE ALL DATA from the public schema AND Storage.
-- It preserves the table structure (schema) but wipes the content.
-- Use this to reset the application state to empty.

BEGIN;

-- 1. Disable triggers to prevent interference/cascading errors during cleanup
SET session_replication_role = 'replica';

-- 2. TRUNCATE public tables (cleaner and faster than DELETE)
-- Cascading to ensure dependent constraints are handled
TRUNCATE TABLE 
  public.messages,
  public.conversation_members,
  public.conversations,
  public.bookings,
  public.availability_slots,
  public.connection_requests,
  public.connections,
  public.saved_users,
  public.student_profiles,
  public.tutor_profiles,
  public.counselor_profiles,
  public.profiles
  CASCADE;

-- 3. CLEAN UP STORAGE (files uploaded by users)
-- This is likely what is blocking the user deletion due to "owner" foreign key
DELETE FROM storage.objects;

-- 4. Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- NOTE: Now you should be able to go to Authentication > Users and delete everyone.
