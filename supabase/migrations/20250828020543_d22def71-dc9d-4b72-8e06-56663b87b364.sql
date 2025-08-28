-- Temporarily disable any triggers that might be blocking auth user creation
-- This will allow magic links to work without custom validation
DROP TRIGGER IF EXISTS validate_auth_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS validate_auth_user ON auth.users;

-- Check what triggers exist on auth.users table  
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_schema = 'auth' 
AND event_object_table = 'users';