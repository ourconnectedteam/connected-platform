-- ============================================
-- FIX: Conversations INSERT RLS Policy
-- ============================================
-- Problem: WITH CHECK clause might be evaluating creator_id before/after trigger
-- Solution: Make the policy explicitly allow the row that the trigger will create
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    -- Allow if user is authenticated (trigger will set creator_id)
    auth.uid() IS NOT NULL
    -- AND creator_id will be set by trigger to auth.uid()
    AND (creator_id IS NULL OR creator_id = auth.uid())
  );
