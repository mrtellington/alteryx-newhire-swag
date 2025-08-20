-- Link harsh.gussain@alteryx.com's existing auth account to their database record
UPDATE public.users 
SET auth_user_id = 'b0933c8e-b914-4157-b216-d2ef213a3536' 
WHERE email = 'harsh.gussain@alteryx.com';