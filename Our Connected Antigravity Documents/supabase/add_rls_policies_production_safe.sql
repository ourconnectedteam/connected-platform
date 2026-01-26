-- ============================================
-- PRODUCTION-SAFE RLS POLICIES MIGRATION
-- ============================================
-- This migration is safe to run on production with existing data.
-- It is fully re-runnable and includes backfills for existing data.
-- ============================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON public.bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_lookup ON public.conversation_members(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_provider_id ON public.availability_slots(provider_id);


-- ============================================
-- BOOKINGS TABLE RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Students can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Booking parties can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Students can delete their own bookings" ON public.bookings;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = student_id OR auth.uid() = provider_id);

CREATE POLICY "Students can create their own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Booking parties can update their bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = student_id OR auth.uid() = provider_id);

CREATE POLICY "Students can delete their own bookings"
  ON public.bookings FOR DELETE
  USING (auth.uid() = student_id);

DROP TRIGGER IF EXISTS booking_ownership_immutable ON public.bookings;

CREATE OR REPLACE FUNCTION public.prevent_booking_ownership_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.student_id IS DISTINCT FROM NEW.student_id THEN
    RAISE EXCEPTION 'Cannot change student_id of existing booking';
  END IF;
  IF OLD.provider_id IS DISTINCT FROM NEW.provider_id THEN
    RAISE EXCEPTION 'Cannot change provider_id of existing booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_ownership_immutable
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_booking_ownership_change();


-- ============================================
-- CONVERSATIONS TABLE - CREATOR_ID SETUP
-- ============================================

-- Add creator_id column if it doesn't exist
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS creator_id uuid references public.profiles(id);

-- Backfill creator_id for existing conversations (deterministic)
DO $$
DECLARE
  has_created_at boolean;
BEGIN
  -- Check if conversation_members has created_at column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'conversation_members' 
      AND column_name = 'created_at'
  ) INTO has_created_at;

  IF has_created_at THEN
    -- Use created_at to find earliest member
    UPDATE public.conversations
    SET creator_id = (
      SELECT user_id 
      FROM public.conversation_members 
      WHERE conversation_members.conversation_id = conversations.id 
      ORDER BY created_at ASC 
      LIMIT 1
    )
    WHERE creator_id IS NULL;
  ELSE
    -- Fall back to ORDER BY user_id for deterministic result
    UPDATE public.conversations
    SET creator_id = (
      SELECT user_id 
      FROM public.conversation_members 
      WHERE conversation_members.conversation_id = conversations.id
      ORDER BY user_id ASC
      LIMIT 1
    )
    WHERE creator_id IS NULL;
  END IF;
END $$;

-- Create trigger to auto-set creator_id on insert
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


-- ============================================
-- CONVERSATIONS TABLE RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can delete their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Creators can delete conversations" ON public.conversations;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

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


-- ============================================
-- CONVERSATION INVITATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversation_invitations (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  inviter_id uuid references public.profiles(id) not null,
  invitee_id uuid references public.profiles(id) not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique(conversation_id, invitee_id)
);

DROP POLICY IF EXISTS "Users can view their invitations" ON public.conversation_invitations;
DROP POLICY IF EXISTS "Members can invite others" ON public.conversation_invitations;
DROP POLICY IF EXISTS "Invitees can update invitation status" ON public.conversation_invitations;
DROP POLICY IF EXISTS "Inviters can cancel invitations" ON public.conversation_invitations;

ALTER TABLE public.conversation_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their invitations"
  ON public.conversation_invitations FOR SELECT
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

CREATE POLICY "Members can invite others"
  ON public.conversation_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = conversation_invitations.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can update invitation status"
  ON public.conversation_invitations FOR UPDATE
  USING (auth.uid() = invitee_id);

CREATE POLICY "Inviters can cancel invitations"
  ON public.conversation_invitations FOR DELETE
  USING (auth.uid() = inviter_id AND status = 'pending');


-- ============================================
-- CONVERSATION_MEMBERS TABLE RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can accept invitations to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join as creator or via invitation" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can add others to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can update their own last_read_at" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can remove themselves from conversations" ON public.conversation_members;

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join as creator or via invitation"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations
        WHERE id = conversation_members.conversation_id
          AND creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.conversation_invitations
        WHERE conversation_id = conversation_members.conversation_id
          AND invitee_id = auth.uid()
          AND status = 'pending'
      )
    )
  );

CREATE POLICY "Users can update their own last_read_at"
  ON public.conversation_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS conversation_member_immutable ON public.conversation_members;

CREATE OR REPLACE FUNCTION public.prevent_conversation_member_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id of conversation member';
  END IF;
  IF OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    RAISE EXCEPTION 'Cannot change conversation_id of conversation member';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER conversation_member_immutable
  BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_conversation_member_change();

CREATE POLICY "Users can remove themselves from conversations"
  ON public.conversation_members FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- MESSAGES TABLE RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can read messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can edit recent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );


-- ============================================
-- AVAILABILITY_SLOTS TABLE RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Anyone can view availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Public slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Authenticated users can view availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Providers can create their own slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Provider manage slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Providers can update their own slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Providers can delete their own slots" ON public.availability_slots;

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view availability slots"
  ON public.availability_slots FOR SELECT
  USING (true);

CREATE POLICY "Providers can create their own slots"
  ON public.availability_slots FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can update their own slots"
  ON public.availability_slots FOR UPDATE
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can delete their own slots"
  ON public.availability_slots FOR DELETE
  USING (auth.uid() = provider_id);
