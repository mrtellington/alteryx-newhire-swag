-- Remove tod.ellington@whitestonebranding.com from users table
DELETE FROM public.users WHERE email = 'tod.ellington@whitestonebranding.com';

-- Remove from admin_users table if exists
DELETE FROM public.admin_users WHERE email = 'tod.ellington@whitestonebranding.com';