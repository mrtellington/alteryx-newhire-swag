-- Remove the overly permissive policy that exposes all user data
DROP POLICY IF EXISTS "System can check user existence" ON public.users;

-- Log this security fix
INSERT INTO public.security_events (
  event_type,
  metadata,
  severity,
  created_at
) VALUES (
  'security_policy_removed_data_exposure_fix',
  jsonb_build_object(
    'removed_policy', 'System can check user existence',
    'table_affected', 'users',
    'reason', 'Prevented unauthorized access to employee personal data',
    'fix_applied_by', 'security_audit'
  ),
  'high',
  now()
);