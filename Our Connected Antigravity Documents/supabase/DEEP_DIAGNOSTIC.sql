-- ============================================
-- DEEP DIAGNOSTIC - Find The Real Problem
-- ============================================
-- Run each query separately and share ALL results
-- ============================================

-- Query 1: Check if creator_id column exists and its constraints
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'conversations'
  AND column_name = 'creator_id';

-- Query 2: Check ALL columns on conversations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- Query 3: Check if trigger exists and is enabled
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled,
    tgtype AS trigger_type
FROM pg_trigger 
WHERE tgrelid = 'public.conversations'::regclass
  AND tgname = 'set_conversation_creator';

-- Query 4: List ALL policies on conversations (should be exactly 3)
SELECT 
    policyname,
    cmd,
    permissive,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'conversations'
ORDER BY policyname;

-- Query 5: Try to manually create a conversation as a test
-- IMPORTANT: This will show us the EXACT error
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users
INSERT INTO conversations (creator_id) 
VALUES (auth.uid())
RETURNING *;

-- Query 6: Check your current user ID
SELECT auth.uid() AS my_user_id;

-- ============================================
-- INSTRUCTIONS:
-- Run queries 1-6 in order
-- Share screenshots or results of ALL queries
-- Query 5 might fail - that's OK, we need to see the exact error
-- ============================================
