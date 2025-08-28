-- Check for any auth-related triggers that might be interfering
SELECT tablename, trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND (action_statement LIKE '%auth%' OR trigger_name LIKE '%auth%');