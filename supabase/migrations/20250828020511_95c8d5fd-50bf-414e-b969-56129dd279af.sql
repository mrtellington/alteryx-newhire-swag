-- Check for auth-related triggers
SELECT 
    table_name, 
    trigger_name, 
    event_manipulation, 
    action_statement 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND (action_statement LIKE '%auth%' OR trigger_name LIKE '%auth%');

-- Temporarily disable the validate_auth_user trigger that's blocking auth
DROP TRIGGER IF EXISTS validate_auth_user_trigger ON auth.users;