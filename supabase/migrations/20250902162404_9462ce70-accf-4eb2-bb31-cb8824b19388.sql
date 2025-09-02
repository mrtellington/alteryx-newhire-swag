-- Fix phantom auth_user_ids by resetting them to NULL
-- This will allow the fix-missing-auth-users function to properly create auth accounts

-- Log the start of phantom ID cleanup
INSERT INTO public.security_events (
  event_type,
  metadata,
  severity,
  created_at
) VALUES (
  'phantom_auth_ids_cleanup_started',
  jsonb_build_object(
    'total_phantom_users', (SELECT COUNT(*) FROM public.users WHERE auth_user_id IS NOT NULL AND invited = true),
    'reason', 'Previous auth creation failed but left phantom IDs'
  ),
  'high',
  now()
);

-- Reset all phantom auth_user_ids to NULL for invited users
-- This allows them to be processed by fix-missing-auth-users function
UPDATE public.users 
SET auth_user_id = NULL 
WHERE auth_user_id IS NOT NULL 
AND invited = true;

-- Log completion
INSERT INTO public.security_events (
  event_type,
  metadata,
  severity,
  created_at
) VALUES (
  'phantom_auth_ids_reset_completed',
  jsonb_build_object(
    'users_reset', (SELECT changes() WHERE changes() > 0),
    'ready_for_auth_creation', true
  ),
  'medium',
  now()
);