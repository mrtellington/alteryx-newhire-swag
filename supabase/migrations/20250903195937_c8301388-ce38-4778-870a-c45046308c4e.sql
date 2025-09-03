-- Fix admin user auth linking
UPDATE admin_users 
SET auth_user_id = 'a9539eb6-7613-4290-abe4-52c734136c0a' 
WHERE email = 'admin@whitestonebranding.com' AND auth_user_id IS NULL;

-- Also fix any other admin users that might have the same issue
UPDATE admin_users 
SET auth_user_id = (
    SELECT au.id 
    FROM auth.users au 
    WHERE LOWER(au.email) = LOWER(admin_users.email)
)
WHERE auth_user_id IS NULL 
AND EXISTS (
    SELECT 1 FROM auth.users au2 
    WHERE LOWER(au2.email) = LOWER(admin_users.email)
);