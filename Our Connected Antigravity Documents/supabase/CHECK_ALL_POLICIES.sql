-- ============================================
-- CHECK FOR ALL POLICIES ON CONVERSATIONS
-- ============================================
-- Let's see if there are hidden policies blocking us
-- ============================================

-- List ALL policies on conversations table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS "USING clause",
    with_check AS "WITH CHECK clause"
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY cmd, policyname;

-- ============================================
-- We should see exactly 3 policies:
-- 1. "Users can view their conversations" (SELECT)
-- 2. "Authenticated users can create conversations" (INSERT)
-- 3. "Members can update their conversations" (UPDATE)
--
-- If you see MORE than 3, there are conflicting policies!
-- Share the complete list.
-- ============================================
