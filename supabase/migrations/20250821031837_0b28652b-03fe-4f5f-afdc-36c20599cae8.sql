-- Make user_id nullable for admin_users table
ALTER TABLE public.admin_users ALTER COLUMN user_id DROP NOT NULL;

-- Create admin users in the admin_users table
INSERT INTO public.admin_users (email, active) VALUES 
('admin@whitestonebranding.com', true),
('dev@whitestonebranding.com', true),
('cecilia@whitestonebranding.com', true)
ON CONFLICT (email) DO NOTHING;

-- Create auth accounts for admin users
-- Note: These will be created via edge function to ensure proper auth account creation