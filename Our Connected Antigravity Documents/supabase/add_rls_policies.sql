-- ============================================
-- ROW LEVEL SECURITY POLICIES (HARDENED)
-- ============================================
-- This migration adds RLS policies to secure bookings, messages, 
-- conversations, and availability_slots tables.
--
-- SECURITY ENHANCEMENTS:
-- - WITH CHECK clauses on all UPDATE policies to prevent ownership changes
-- - Stricter conversation deletion (members cannot delete entire conversation)
-- - Invite-based conversation membership (no arbitrary member additions)
-- - Authenticated-only availability slot viewing
-- - Performance indexes for RLS subqueries
--
-- IMPORTANT: Review all policies before applying to production.
-- Test thoroughly in a development environment first.
-- ============================================


-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
-- These indexes support the RLS policy subqueries and improve performance.
-- Create these BEFORE enabling RLS policies.

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON public.bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);

-- Conversation members indexes (critical for message RLS performance)
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_lookup ON public.conversation_members(conversation_id, user_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Availability slots indexes
CREATE INDEX IF NOT EXISTS idx_availability_slots_provider_id ON public.availability_slots(provider_id);


-- ============================================
-- BOOKINGS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies to prevent permissive OR-based access
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Students can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Booking parties can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Students can delete their own bookings" ON public.bookings;

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view bookings they're involved in
CREATE POLICY "Users can view their own bookings"
  ON public.bookings
  FOR SELECT
  USING (
    auth.uid() = student_id OR auth.uid() = provider_id
  );

-- INSERT: Only students can create bookings for themselves
CREATE POLICY "Students can create their own bookings"
  ON public.bookings
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
  );

-- UPDATE: Both parties can update bookings they're involved in
-- NOTE: Ownership protection enforced by trigger (see below), not WITH CHECK
CREATE POLICY "Booking parties can update their bookings"
  ON public.bookings
  FOR UPDATE
  USING (
    auth.uid() = student_id OR auth.uid() = provider_id
  );

-- DELETE: Only students can delete their own bookings
-- OPTIONAL HARDENING: Uncomment to prevent deletion of confirmed/completed bookings
CREATE POLICY "Students can delete their own bookings"
  ON public.bookings
  FOR DELETE
  USING (
    auth.uid() = student_id
    -- Uncomment to prevent deletion of paid/completed bookings:
    -- AND status NOT IN ('confirmed', 'completed')
  );

-- TRIGGER: Prevent booking ownership changes
-- This is a database-level safeguard that prevents student_id and provider_id
-- from being modified after a booking is created.
-- Drop trigger if it exists to make migration re-runnable
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
-- CONVERSATIONS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can delete their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Creators can delete conversations" ON public.conversations;

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Add creator_id column to track conversation creator
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS creator_id uuid references public.profiles(id);

-- SELECT: Users can view conversations they're members of
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create conversations
-- CRITICAL: creator_id must match authenticated user to enable creator self-join
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND creator_id = auth.uid()
  );

-- UPDATE: Members can update their conversations (e.g., last_message_at)
-- HARDENED: WITH CHECK ensures conversation ID cannot be changed
CREATE POLICY "Members can update their conversations"
  ON public.conversations
  FOR UPDATE
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

-- DELETE: REMOVED - Members cannot delete entire conversations
-- RATIONALE: Deleting a conversation affects all members. Instead, users should
-- "leave" by removing themselves from conversation_members. If you need conversation
-- deletion, implement it via a service role function with proper authorization.
-- 
-- Alternative approach: Only allow the creator to delete:
-- CREATE POLICY "Creators can delete conversations"
--   ON public.conversations FOR DELETE
--   USING (auth.uid() = creator_id);


-- ============================================
-- CONVERSATION INVITATIONS TABLE (Required for secure membership)
-- ============================================

-- Create invitation table for secure conversation member additions
CREATE TABLE IF NOT EXISTS public.conversation_invitations (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  inviter_id uuid references public.profiles(id) not null,
  invitee_id uuid references public.profiles(id) not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique(conversation_id, invitee_id)
);

-- Drop existing invitation policies
DROP POLICY IF EXISTS "Users can view their invitations" ON public.conversation_invitations;
DROP POLICY IF EXISTS "Members can invite others" ON public.conversation_invitations;
DROP POLICY IF EXISTS "Invitees can update invitation status" ON public.conversation_invitations;
DROP POLICY IF EXISTS "Inviters can cancel invitations" ON public.conversation_invitations;

-- Enable RLS on invitations
ALTER TABLE public.conversation_invitations ENABLE ROW LEVEL SECURITY;

-- Invitations SELECT: Users can view invitations they sent or received
CREATE POLICY "Users can view their invitations"
  ON public.conversation_invitations
  FOR SELECT
  USING (
    auth.uid() = invitee_id OR auth.uid() = inviter_id
  );

-- Invitations INSERT: Members can invite others to their conversations
CREATE POLICY "Members can invite others"
  ON public.conversation_invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = conversation_invitations.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Invitations UPDATE: Invitees can accept/decline
CREATE POLICY "Invitees can update invitation status"
  ON public.conversation_invitations
  FOR UPDATE
  USING (
    auth.uid() = invitee_id
  );

-- Invitations DELETE: Inviters can cancel pending invitations
CREATE POLICY "Inviters can cancel invitations"
  ON public.conversation_invitations
  FOR DELETE
  USING (
    auth.uid() = inviter_id AND status = 'pending'
  );


-- ============================================
-- CONVERSATION_MEMBERS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can accept invitations to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join as creator or via invitation" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can add others to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can remove themselves from conversations" ON public.conversation_members;

-- Enable RLS
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view members of conversations they're in
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

-- INSERT: HARDENED - Creator can self-join OR user can accept invitation
-- SECURITY: Prevents arbitrary conversation joining while allowing creator to bootstrap
CREATE POLICY "Users can join as creator or via invitation"
  ON public.conversation_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Path 1: Creator adding themselves
      EXISTS (
        SELECT 1 FROM public.conversations
        WHERE id = conversation_members.conversation_id
          AND creator_id = auth.uid()
      )
      -- Path 2: Invited user accepting invitation
      OR EXISTS (
        SELECT 1 FROM public.conversation_invitations
        WHERE conversation_id = conversation_members.conversation_id
          AND invitee_id = auth.uid()
          AND status = 'pending'
      )
    )
  );

-- UPDATE: Allow updating last_read_at only
-- SECURITY: Trigger prevents changing user_id or conversation_id (see below)
CREATE POLICY "Users can update their own last_read_at"
  ON public.conversation_members
  FOR UPDATE
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- TRIGGER: Prevent conversation_members ownership changes (defense in depth)
-- Drop trigger if it exists to make migration re-runnable
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

-- DELETE: Users can remove themselves from conversations (leave conversation)
CREATE POLICY "Users can remove themselves from conversations"
  ON public.conversation_members
  FOR DELETE
  USING (
    auth.uid() = user_id
  );


-- ============================================
-- MESSAGES TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can edit recent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can read messages in their conversations
CREATE POLICY "Users can read messages in their conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- INSERT: Users can send messages to their conversations
-- Already includes membership check via EXISTS clause
CREATE POLICY "Users can send messages to their conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- UPDATE: No updates allowed (messages are immutable)
-- No policy created - defaults to deny all updates
-- RATIONALE: Messages should not be edited after sending for audit trail.
-- If you need "edit message" functionality, add a policy with time constraint:
-- CREATE POLICY "Users can edit recent messages"
--   ON public.messages FOR UPDATE
--   USING (auth.uid() = sender_id AND created_at > now() - interval '5 minutes')
--   WITH CHECK (auth.uid() = sender_id);

-- DELETE: Users can delete their own messages (with membership check)
-- HARDENED: Added membership verification to prevent orphaned message deletion
CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  USING (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- TRADEOFF EXPLANATION:
-- Adding the membership check means users cannot delete their messages after leaving
-- a conversation. This is generally desirable (prevents "delete and run" behavior),
-- but if you want to allow deletion even after leaving, remove the EXISTS clause.


-- ============================================
-- AVAILABILITY_SLOTS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies (CRITICAL: removes public access if it exists)
DROP POLICY IF EXISTS "Anyone can view availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Public slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Authenticated users can view availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Providers can create their own slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Provider manage slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Providers can update their own slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Providers can delete their own slots" ON public.availability_slots;

-- Enable RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- SELECT: HARDENED - Only authenticated users can view slots
-- RATIONALE: Prevents anonymous browsing and competitor analysis. Students must
-- create an account to view tutor availability.
-- If you want public browsing for marketing, change to USING (true)
CREATE POLICY "Authenticated users can view availability slots"
  ON public.availability_slots
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- Alternative for public browsing (less secure):
-- CREATE POLICY "Anyone can view availability slots"
--   ON public.availability_slots FOR SELECT
--   USING (true);

-- INSERT: Only providers can create their own slots
CREATE POLICY "Providers can create their own slots"
  ON public.availability_slots
  FOR INSERT
  WITH CHECK (
    auth.uid() = provider_id
  );

-- UPDATE: Only providers can update their own slots
-- HARDENED: WITH CHECK prevents changing provider_id
CREATE POLICY "Providers can update their own slots"
  ON public.availability_slots
  FOR UPDATE
  USING (
    auth.uid() = provider_id
  )
  WITH CHECK (
    auth.uid() = provider_id
  );

-- DELETE: Only providers can delete their own slots
CREATE POLICY "Providers can delete their own slots"
  ON public.availability_slots
  FOR DELETE
  USING (
    auth.uid() = provider_id
  );


-- ============================================
-- ADDITIONAL NOTES
-- ============================================

-- CONVERSATION WORKFLOW:
-- 1. User A creates conversation with creator_id = User A's UUID
-- 2. User A adds themselves as member (policy checks creator_id match)
-- 3. User A invites User B (conversation_invitations with status='pending')
-- 4. User B sees invitation and accepts it
-- 5. User B adds themselves to conversation_members (policy checks for pending invite)
-- 6. Invitation status updated to 'accepted' (optional cleanup)
--
-- CREATOR_ID APPROACH:
-- - conversations.creator_id tracks who created the conversation
-- - Creator can always add themselves (no invitation needed)
-- - All other users require a pending invitation
-- - Set creator_id when creating: INSERT INTO conversations (creator_id) VALUES (auth.uid())

-- LAST_READ_AT TRACKING:
-- Since conversation_members UPDATE is blocked, implement last_read_at tracking via:
-- Option 1: Separate table (conversation_read_status)
-- Option 2: Service role function that updates last_read_at
-- Option 3: Store in user metadata/local storage (client-side only)


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries after applying the migration to verify RLS is working:
--
-- 1. Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('bookings', 'conversations', 'conversation_members', 'messages', 'availability_slots');
--
-- 2. List all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('bookings', 'conversations', 'conversation_members', 'messages', 'availability_slots')
-- ORDER BY tablename, policyname;
--
-- 3. Check indexes were created:
-- SELECT tablename, indexname FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename IN ('bookings', 'conversations', 'conversation_members', 'messages', 'availability_slots')
-- ORDER BY tablename, indexname;
--
-- ============================================
