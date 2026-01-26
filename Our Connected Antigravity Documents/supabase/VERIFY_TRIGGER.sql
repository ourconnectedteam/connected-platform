-- ============================================
-- VERIFY TRIGGER IS WORKING
-- ============================================
-- Run this to test if the trigger now sets creator_id correctly
-- ============================================

-- Delete the test conversation with NULL creator_id
DELETE FROM public.conversations 
WHERE creator_id IS NULL;

-- Now insert a new conversation
-- The trigger should automatically set creator_id = your user ID
INSERT INTO public.conversations (creator_id)
VALUES (auth.uid())
RETURNING 
    id,
    creator_id,
    CASE 
        WHEN creator_id IS NULL THEN '❌ TRIGGER NOT WORKING'
        WHEN creator_id = auth.uid() THEN '✅ TRIGGER WORKING!'
        ELSE '⚠️ UNEXPECTED VALUE'
    END as test_result;

-- ============================================
-- EXPECTED RESULT:
-- - creator_id should be YOUR user ID (UUID)
-- - test_result should show "✅ TRIGGER WORKING!"
-- 
-- If you see this, messaging will work on your website!
-- ============================================
