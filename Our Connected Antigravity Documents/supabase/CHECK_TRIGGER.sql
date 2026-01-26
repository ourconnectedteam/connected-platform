-- ============================================
-- CHECK IF TRIGGER EXISTS AND IS ENABLED
-- ============================================

-- Query 1: Check if trigger exists
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled_status,
    CASE tgenabled
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'R' THEN 'Replica only'
        WHEN 'A' THEN 'Always'
        ELSE 'Unknown'
    END as status_description
FROM pg_trigger 
WHERE tgrelid = 'public.conversations'::regclass
  AND tgname = 'set_conversation_creator';

-- Query 2: Check if the function exists
SELECT 
    proname AS function_name,
    prosrc AS function_code
FROM pg_proc
WHERE proname = 'set_conversation_creator';

-- ============================================
-- INSTRUCTIONS:
-- Run both queries and share the results
-- If Query 1 returns no rows → trigger doesn't exist
-- If Query 2 returns no rows → function doesn't exist  
-- ============================================
