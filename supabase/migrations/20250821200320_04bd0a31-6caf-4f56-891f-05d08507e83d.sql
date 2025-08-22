-- CRITICAL SECURITY FIX: Fix is_system_admin function vulnerability
-- The function was returning NULL instead of false, bypassing RLS policies

DROP FUNCTION IF EXISTS public.is_system_admin();

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

-- Test the function works correctly
DO $$
DECLARE
  result boolean;
BEGIN
  SELECT public.is_system_admin() INTO result;
  RAISE NOTICE 'is_system_admin() test result: %', COALESCE(result::text, 'NULL');
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
    'vulnerability', 'is_system_admin_function_returned_null',
    'impact', 'allowed_unauthorized_access_to_admin_emails',
    'fix', 'function_now_returns_false_for_unauthorized_users',
    'severity_reason', 'admin_emails_were_accessible_to_any_authenticated_user'
  ),
  'critical',
  now()
);