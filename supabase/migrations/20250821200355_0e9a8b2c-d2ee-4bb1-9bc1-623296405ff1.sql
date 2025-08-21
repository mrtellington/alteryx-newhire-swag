-- CRITICAL SECURITY FIX: Replace is_system_admin function to fix NULL return vulnerability
-- Using CREATE OR REPLACE to avoid dropping dependencies

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_email TEXT;
  admin_emails TEXT[] := ARRAY[
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  ];
BEGIN
  -- Get current user email from JWT claims (with proper error handling)
  BEGIN
    current_email := LOWER(TRIM(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)));
  EXCEPTION WHEN OTHERS THEN
    -- If we can't get email from JWT, definitely not an admin
    RETURN false;
  END;
  
  -- Return false if email is null or empty
  IF current_email IS NULL OR current_email = '' THEN
    RETURN false;
  END IF;
  
  -- Check if current email is in the admin whitelist
  RETURN current_email = ANY(admin_emails);
END;
$$;

-- Test the function now works correctly and returns false instead of null
DO $$
DECLARE
  result boolean;
BEGIN
  SELECT public.is_system_admin() INTO result;
  IF result IS NULL THEN
    RAISE EXCEPTION 'SECURITY ERROR: is_system_admin() still returns NULL!';
  END IF;
  RAISE NOTICE 'is_system_admin() fixed - result: %', result;
END;
$$;

-- Log this critical security fix
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'critical_rls_vulnerability_fixed',
  'system',
  jsonb_build_object(
    'vulnerability', 'is_system_admin_function_returned_null_bypassing_rls',
    'impact', 'admin_emails_accessible_to_any_authenticated_user',
    'fix', 'function_now_properly_returns_false_with_error_handling',
    'tables_protected', ARRAY['admin_users', 'inventory']
  ),
  'critical',
  now()
);