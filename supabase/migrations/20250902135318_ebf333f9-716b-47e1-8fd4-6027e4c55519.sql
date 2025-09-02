-- Temporarily disable the validate_auth_user trigger to allow new auth user creation
DROP TRIGGER IF EXISTS validate_auth_user_trigger ON auth.users;