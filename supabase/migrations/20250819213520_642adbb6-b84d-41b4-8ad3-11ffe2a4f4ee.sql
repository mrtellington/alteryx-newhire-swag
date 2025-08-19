-- Clear all standard users from the database
DELETE FROM public.orders;
DELETE FROM public.users;

-- Clear all admin users 
DELETE FROM public.admin_users;

-- Add the 3 specified admin users
INSERT INTO public.admin_users (email, user_id, active, created_at) VALUES
('cecilia@whitestonebranding.com', gen_random_uuid(), true, now()),
('admin@whitestonebranding.com', gen_random_uuid(), true, now()),
('dev@whitestonebranding.com', gen_random_uuid(), true, now());