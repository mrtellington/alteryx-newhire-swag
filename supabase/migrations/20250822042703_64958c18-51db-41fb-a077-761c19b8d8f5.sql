-- Add the primary admin account back to admin_users
INSERT INTO public.admin_users (email, full_name, active, role)
VALUES ('admin@whitestonebranding.com', 'System Administrator', true, 'admin')
ON CONFLICT (email) DO NOTHING;

-- Remove Tod Ellington from admin_users since he should be a regular user
DELETE FROM public.admin_users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Log this admin setup fix
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'admin_users_setup_fixed',
  'admin@whitestonebranding.com',
  jsonb_build_object(
    'action', 'restored_primary_admin_and_removed_incorrect_admin',
    'removed_user', 'tod.ellington@whitestonebranding.com',
    'reason', 'tod_ellington_should_be_regular_user_not_admin'
  ),
  'medium',
  now()
);