-- Remove Christian Houston from both users and admin_users tables for reimport testing
DELETE FROM public.admin_users WHERE email = 'christian.houston@whitestonebranding.com';
DELETE FROM public.users WHERE email = 'christian.houston@whitestonebranding.com';