-- Remove the foreign key constraint that requires users.id to reference auth.users(id)
-- This allows creating users from webhook without requiring auth user creation
ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;

-- Keep the auth_user_id foreign key constraint as it's nullable and optional
-- This allows users to exist without auth accounts, but if they do have auth accounts, they must be valid