-- ============================================
-- DIAGNOSTIC QUERIES - Run These to Debug
-- ============================================
-- Copy and run each section separately in Supabase SQL Editor
-- to diagnose what's happening
-- ============================================

-- 1. Check if creator_id column exists on conversations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'conversations';

-- 2. Check if the trigger exists
SELECT tgname, tgenabled
FROM pg_trigger 
WHERE tgrelid = 'public.conversations'::regclass;

-- 3. Check if the trigger function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'set_conversation_creator';

-- 4. List ALL RLS policies on conversations table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'conversations';

-- 5. Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'conversations';

-- ============================================
-- INSTRUCTIONS:
-- 1. Copy sections 1-5 above, one at a time
-- 2. Paste into SQL Editor and run
-- 3. Screenshot or copy the results for each query
-- 4. Share the results so we can diagnose the issue
-- ============================================
