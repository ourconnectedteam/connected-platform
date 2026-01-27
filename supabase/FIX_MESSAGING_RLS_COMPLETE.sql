-- ==========================================================
-- FINAL FIX FOR MESSAGING RLS & MISSING TABLES
-- ==========================================================

-- 1. Ensure 'conversation_invitations' table exists (referenced in JS but missing in schema)
CREATE TABLE IF NOT EXISTS public.conversation_invitations (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  inviter_id uuid references public.profiles(id) not null,
  invitee_id uuid references public.profiles(id) not null,
  status text default 'pending', -- 'pending', 'accepted', 'declined'
  created_at timestamp with time zone default now()
);

-- 2. ENABLE RLS on all messaging tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_invitations ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES FOR CONVERSATIONS
DROP POLICY IF EXISTS "Users can view conversations they are in" ON public.conversations;
CREATE POLICY "Users can view conversations they are in"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;
CREATE POLICY "Members can update conversations"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- 4. POLICIES FOR CONVERSATION MEMBERS
-- This was the specific failure point

DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    -- I can see my own membership
    user_id = auth.uid() 
    OR 
    -- I can see members of conversations I belong to
    conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can join conversations (add themselves)" ON public.conversation_members;
CREATE POLICY "Users can join conversations (add themselves)"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Members can add other users" ON public.conversation_members;
CREATE POLICY "Members can add other users"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    -- I am already a member of this conversation
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversation_members.conversation_id
      AND user_id = auth.uid()
    )
  );

-- 5. POLICIES FOR MESSAGES
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can insert messages" ON public.messages;
CREATE POLICY "Members can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    -- Sender must be me
    sender_id = auth.uid()
    AND
    -- I must be a member of the conversation
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can update messages (read status)" ON public.messages;
CREATE POLICY "Members can update messages (read status)"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

-- 6. POLICIES FOR INVITATIONS
DROP POLICY IF EXISTS "Users can view their invitations" ON public.conversation_invitations;
CREATE POLICY "Users can view their invitations"
  ON public.conversation_invitations FOR SELECT
  USING (
    inviter_id = auth.uid() OR invitee_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can create invitations" ON public.conversation_invitations;
CREATE POLICY "Authenticated users can create invitations"
  ON public.conversation_invitations FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their invitations" ON public.conversation_invitations;
CREATE POLICY "Users can update their invitations"
  ON public.conversation_invitations FOR UPDATE
  USING (
    inviter_id = auth.uid() OR invitee_id = auth.uid()
  );
