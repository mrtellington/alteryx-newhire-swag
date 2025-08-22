-- Add dev@whitestonebranding.com as view-only admin
INSERT INTO public.admin_users (
  email, 
  role, 
  active, 
  full_name,
  created_at
) VALUES (
  'dev@whitestonebranding.com',
  'view_only',
  true,
  'Development Team',
  now()
);