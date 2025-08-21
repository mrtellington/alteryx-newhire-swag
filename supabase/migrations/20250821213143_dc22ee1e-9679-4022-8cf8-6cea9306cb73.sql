-- Call the create-auth-users function to properly link Tod's existing auth account
-- This should update his auth_user_id field in the users table
SELECT supabase.functions.invoke('create-auth-users', '{}');