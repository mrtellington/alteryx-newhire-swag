-- Update all users with NULL auth_user_id to link them to their corresponding auth users
UPDATE public.users 
SET auth_user_id = auth_users.id
FROM auth.users AS auth_users
WHERE public.users.auth_user_id IS NULL 
AND LOWER(public.users.email) = LOWER(auth_users.email);