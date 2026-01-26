-- ============================================
-- CLEAN SLATE RESET - MESSAGING SYSTEM
-- ============================================
-- 1. Clears ALL existing policies on conversations
-- 2. Removes the complex triggers we don't need anymore
-- 3. Sets up 3 SIMPLE, STANDARD policies
-- ============================================

-- 1. DROP EVERYTHING (Start Clean)
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service role access" ON public.conversations;

-- Remove the trigger (We don't need it because client code is fixed!)
DROP TRIGGER IF EXISTS set_conversation_creator ON public.conversations;
DROP FUNCTION IF EXISTS public.set_conversation_creator();

-- Ensure RLS is ON
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 2. CREATE SIMPLE POLICIES

-- Policy 1: VIEW (Select)
-- Users can see conversations they are a member of
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- Policy 2: CREATE (Insert)
-- Authenticated users can create new conversations
-- Simple check: "Is the user authenticated?"
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Policy 3: UPDATE (Update)
-- Members can update the conversation (e.g. updating last_message_at)
CREATE POLICY "Members can update their conversations"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- 3. VERIFY SUCCESS
SELECT 'Clean reset complete. Simple policies applied.' as status;
