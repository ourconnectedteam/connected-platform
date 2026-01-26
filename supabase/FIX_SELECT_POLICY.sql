-- ============================================
-- THE MISSING PIECE FIX
-- ============================================
-- The previous reset created a "Catch-22":
-- 1. You insert a conversation
-- 2. You try to SELECT it back (RETURNING *)
-- 3. But the SELECT policy only checks 'conversation_members'
-- 4. You aren't a member yet! So it blocks you.
--
-- ALSO: We need to handle the old client sending empty {}
-- ============================================

-- Step 1: Fix the NULL creator_id issue for old clients
-- Automatically set creator_id to the user if they send empty {}
ALTER TABLE public.conversations 
ALTER COLUMN creator_id SET DEFAULT auth.uid();

-- Step 2: Fix the SELECT policy to allow the creator to see it
-- This fixes the "insert().select()" failure
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    creator_id = auth.uid() -- ✅ Allow creator to see it immediately
    OR
    EXISTS ( -- ✅ OR allow members to see it
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- Step 3: Verify
SELECT 'Fix applied: DEFAULT added + SELECT policy updated' as status;
