-- Remove christian.houston@whitestonebranding.com from all tables

-- Remove from admin_users table
DELETE FROM public.admin_users 
WHERE LOWER(email) = 'christian.houston@whitestonebranding.com';

-- Remove from users table
DELETE FROM public.users 
WHERE LOWER(email) = 'christian.houston@whitestonebranding.com';

-- Remove from security_events table
DELETE FROM public.security_events 
WHERE LOWER(user_email) = 'christian.houston@whitestonebranding.com';