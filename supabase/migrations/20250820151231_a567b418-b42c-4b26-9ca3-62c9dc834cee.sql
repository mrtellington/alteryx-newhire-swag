-- Remove Tejal Makuck from users table
DELETE FROM public.users WHERE LOWER(email) = 'tejal.makuck@whitestonebranding.com';

-- Remove her auth user (this will also cascade delete from auth.users)
-- Note: We'll need to use the admin API from an edge function to delete auth users
-- For now, just remove from our users table - the auth cleanup function will handle the auth user