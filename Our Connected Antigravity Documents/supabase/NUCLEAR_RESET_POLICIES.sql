-- ============================================
-- NUCLEAR OPTION: Complete RLS Reset for Conversations
-- ============================================
-- This will drop ALL policies and recreate from scratch
-- Use this if diagnostic queries show multiple conflicting policies
-- ============================================

-- 1. Drop ALL existing policies on conversations table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'conversations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol.policyname);
    END LOOP;
END $$;

-- 2. Ensure creator_id column exists
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profiles(id);

-- 3. Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.set_conversation_creator()
RETURNS TRIGGER AS $$
BEGIN
  NEW.creator_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS set_conversation_creator ON public.conversations;
CREATE TRIGGER set_conversation_creator
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversation_creator();

-- 5. Create fresh SELECT policy
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- 6. Create fresh INSERT policy  
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (creator_id IS NULL OR creator_id = auth.uid())
  );

-- 7. Create fresh UPDATE policy
CREATE POLICY "Members can update their conversations"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- 8. Ensure RLS is enabled
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Success!
SELECT 'All policies reset successfully!' AS status;
