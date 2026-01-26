-- ============================================
-- FINAL FIX: Infinite recursion in conversation_members
-- ============================================
-- Problem: The SELECT policy was querying conversation_members within itself
-- Solution: Use a security definer function to break the recursion
-- ============================================

-- Step 1: Create a helper function that checks membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_members 
    WHERE conversation_id = conv_id 
      AND conversation_members.user_id = user_id
  );
$$;

-- Step 2: Drop and recreate the policy using the function
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;

CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );
