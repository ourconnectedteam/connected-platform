-- ============================================
-- FINAL FIX: Complete Trigger + Policy Reset
-- ============================================
-- This ensures BOTH the trigger AND policy work together
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing trigger if any
DROP TRIGGER IF EXISTS set_conversation_creator ON public.conversations CASCADE;

-- Step 2: Drop existing function if any  
DROP FUNCTION IF EXISTS public.set_conversation_creator() CASCADE;

-- Step 3: Create the trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_conversation_creator()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Force creator_id to be the authenticated user
  -- This prevents spoofing and ensures consistency
  NEW.creator_id := auth.uid();
  RETURN NEW;
END;
$$;

-- Step 4: Create the BEFORE INSERT trigger
CREATE TRIGGER set_conversation_creator
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversation_creator();

-- Step 5: Verify trigger was created
SELECT 
    'Trigger created successfully!' AS status,
    tgname AS trigger_name,
    tgenabled AS enabled
FROM pg_trigger 
WHERE tgrelid = 'public.conversations'::regclass
  AND tgname = 'set_conversation_creator';

-- ============================================
-- AFTER RUNNING THIS:
-- 1. Go back to TEST_INSERT.sql
-- 2. Run the INSERT query again
-- 3. creator_id should NOT be NULL this time
-- 4. Then test messaging on your website
-- ============================================
