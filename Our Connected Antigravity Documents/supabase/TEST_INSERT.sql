-- ============================================
-- DIRECT INSERT TEST - Run in Supabase SQL Editor
-- ============================================
-- This will show us the EXACT error that's blocking conversation creation
-- ============================================

-- Step 1: Check your user ID
SELECT auth.uid() AS my_user_id;

-- Step 2: Try to insert a conversation the way the client does
-- This should show us the exact error
INSERT INTO public.conversations (creator_id)
VALUES (auth.uid())
RETURNING *;

-- ============================================
-- SHARE THE RESULTS:
-- - If Step 1 shows a user ID → good, you're authenticated
-- - If Step 2 fails, copy the EXACT error message
-- - If Step 2 succeeds, the problem is client-side
-- ============================================
