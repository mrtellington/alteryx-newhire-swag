-- Create admin users in the admin_users table
INSERT INTO public.admin_users (email, active) VALUES 
('admin@whitestonebranding.com', true),
('dev@whitestonebranding.com', true),
('cecilia@whitestonebranding.com', true)
ON CONFLICT (email) DO NOTHING;