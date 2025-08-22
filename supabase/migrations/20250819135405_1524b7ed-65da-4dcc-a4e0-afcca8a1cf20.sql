-- Add cecilia@whitestonebranding.com as an admin user
INSERT INTO public.admin_users (user_id, email, active)
VALUES (gen_random_uuid(), 'cecilia@whitestonebranding.com', true)
ON CONFLICT (email) DO NOTHING;