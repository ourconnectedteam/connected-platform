-- ==========================================================
-- FIX INFINITE RECURSION IN MESSAGING RLS
-- ==========================================================

-- PROBLEM: The policy on "conversation_members" tried to query "conversation_members" to check permissions,
-- causing an infinite loop (Recursion).
-- SOLUTION: We create a "Security Definer" function. This function runs with system privileges
-- and bypasses RLS, allowing us to safely check membership without triggering the loop.

-- 1. Create the helper function
CREATE OR REPLACE FUNCTION public.is_member_of(_conversation_id uuid)
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER -- <--- This is the magic key. It bypasses RLS for this specific check.
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = _conversation_id
    AND user_id = auth.uid()
  );
$$;

-- 2. Drop the buggy policy
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;

-- 3. Create the new, safe policy
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    -- 1. I can always see myself
    user_id = auth.uid() 
    OR 
    -- 2. I can see others IF I am a member of that conversation (using the safe function)
    is_member_of(conversation_id)
  );

-- 4. Verify it works
SELECT 'Recursion fix applied successfully.' as status;
