-- Fix admin configuration: Remove tod.ellington from admin_users table
DELETE FROM public.admin_users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Add tod.ellington as a regular user in the users table
INSERT INTO public.users (
  email,
  full_name,
  invited,
  order_submitted,
  created_at
) VALUES (
  'tod.ellington@whitestonebranding.com',
  'Tod Ellington',
  true,
  false,
  now()
);