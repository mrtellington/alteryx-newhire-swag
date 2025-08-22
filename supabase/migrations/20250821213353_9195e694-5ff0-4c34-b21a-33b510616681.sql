-- Let's check if Tod's user record still exists and what his auth_user_id is
SELECT id, email, auth_user_id, invited, order_submitted 
FROM public.users 
WHERE email = 'tod.ellington@gmail.com';

-- Also check if there are any users without auth_user_id
SELECT COUNT(*) as users_without_auth, 
       string_agg(email, ', ') as emails
FROM public.users 
WHERE auth_user_id IS NULL AND invited = true;