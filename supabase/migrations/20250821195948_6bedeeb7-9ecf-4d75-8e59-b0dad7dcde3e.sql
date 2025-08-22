-- Fix authentication issue: Add missing system admin to admin_users table
-- Tod Ellington is hardcoded as a system admin but missing from admin_users table

INSERT INTO public.admin_users (email, active, created_at) 
VALUES (
  'tod.ellington@whitestonebranding.com', 
  true, 
  now()
) ON CONFLICT (email) DO UPDATE SET active = true;

-- Also ensure admin@whitestonebranding.com is in the table
INSERT INTO public.admin_users (email, active, created_at) 
VALUES (
  'admin@whitestonebranding.com', 
  true, 
  now()
) ON CONFLICT (email) DO UPDATE SET active = true;

-- Log the fix
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'system_admin_access_restored',
  'tod.ellington@whitestonebranding.com',
  jsonb_build_object(
    'issue', 'system_admin_missing_from_admin_users_table',
    'fix', 'added_to_admin_users_with_active_status',
    'impact', 'authentication_now_working'
  ),
  'medium',
  now()
);