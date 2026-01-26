-- ============================================
-- COMPLETE RLS FIX: Universal Messaging
-- ============================================
-- This script fixes the conversation creation policy to work with all user types.
-- Run this entire script in your Supabase SQL Editor.
-- ============================================

-- Step 1: Ensure the trigger function exists
-- This function automatically sets creator_id to the authenticated user
CREATE OR REPLACE FUNCTION public.set_conversation_creator()
RETURNS TRIGGER AS $$
BEGIN
  -- Always force creator_id to authenticated user (prevent spoofing)
  NEW.creator_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Ensure the trigger exists on the conversations table
DROP TRIGGER IF EXISTS set_conversation_creator ON public.conversations;

CREATE TRIGGER set_conversation_creator
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversation_creator();

-- Step 3: Drop any conflicting conversation INSERT policies
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- Step 4: Create the corrected INSERT policy
-- This policy works WITH the trigger (not against it)
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    -- Allow creator_id to be NULL (trigger will set it) OR already match auth.uid()
    AND (creator_id IS NULL OR creator_id = auth.uid())
  );

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this query to verify the policy was created:
-- SELECT * FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Authenticated users can create conversations';
--
-- Run this to verify the trigger exists:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'set_conversation_creator';
-- ============================================

-- Success! The fix is now applied.
