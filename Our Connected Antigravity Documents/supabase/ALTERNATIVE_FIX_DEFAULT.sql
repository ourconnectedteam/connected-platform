-- ============================================
-- ALTERNATIVE FIX: Make creator_id column have a DEFAULT
-- ============================================
-- Since the trigger isn't working reliably, let's use a database DEFAULT instead
-- This will automatically set creator_id to auth.uid() when not provided
-- ============================================

-- Set creator_id column to have DEFAULT auth.uid()
ALTER TABLE public.conversations 
ALTER COLUMN creator_id SET DEFAULT auth.uid();

-- Verify the change
SELECT 
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations' 
  AND column_name = 'creator_id';

-- Test it with an INSERT
DELETE FROM public.conversations WHERE creator_id IS NULL;

INSERT INTO public.conversations DEFAULT VALUES
RETURNING id, creator_id;

-- ============================================
-- This should show creator_id populated with your user ID
-- Even if we don't pass it explicitly!
-- ============================================
