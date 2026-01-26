-- ============================================
-- FIX: RLS Conversation Policy - Universal Messaging
-- ============================================
-- Problem: Users can only message specific users, not all users universally
--          (e.g., can message one tutor but not counselors, study buddies, etc.)
-- Root Cause: INSERT policy checks creator_id BEFORE trigger sets it
-- Solution: Allow NULL creator_id during INSERT (trigger will set it)
-- Scope: Fixes messaging for ALL user types (tutors, counselors, students, anyone)
-- ============================================

-- Drop the conflicting policy
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- Create the corrected policy
-- This allows authenticated users to create conversations
-- The trigger (set_conversation_creator) will automatically set creator_id to auth.uid()
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    -- Allow creator_id to be NULL (trigger will set it) OR match auth.uid()
    AND (creator_id IS NULL OR creator_id = auth.uid())
  );

-- Verify the trigger exists (this should already be in place from production_safe migration)
-- If not, uncomment and run:
/*
DROP TRIGGER IF EXISTS set_conversation_creator ON public.conversations;

CREATE OR REPLACE FUNCTION public.set_conversation_creator()
RETURNS TRIGGER AS $$
BEGIN
  -- Always force creator_id to authenticated user (prevent spoofing)
  NEW.creator_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_conversation_creator
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversation_creator();
*/

-- ============================================
-- EXPLANATION
-- ============================================
-- Why this works:
-- 1. When creating a conversation, the client can pass creator_id as NULL or auth.uid()
-- 2. The policy allows both scenarios: (creator_id IS NULL OR creator_id = auth.uid())
-- 3. The BEFORE INSERT trigger runs and sets creator_id to auth.uid()
-- 4. The final row has creator_id = auth.uid() which satisfies all constraints
--
-- This fixes the issue where the policy was checking creator_id = auth.uid()
-- BEFORE the trigger could set it, causing a policy violation.
-- ============================================
