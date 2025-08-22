-- Update other functions and policies to use the new secure admin check function

-- Update the is_user_admin function to use the new secure approach
CREATE OR REPLACE FUNCTION public.is_user_admin(user_email text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  check_email TEXT;
BEGIN
  -- Use provided email or get from JWT claims
  check_email := COALESCE(
    user_email, 
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
  );
  
  -- Use the new secure admin check function
  RETURN public.is_current_user_admin();
END;
$function$;

-- Update RLS policies on other tables that were using get_current_user_admin_status
-- Users table policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update any user"
ON public.users
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Orders table policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;

CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update all orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Security events table policies  
DROP POLICY IF EXISTS "Only admins can view security_events" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can update security_events" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can delete security_events" ON public.security_events;
DROP POLICY IF EXISTS "Admins can view security dashboard" ON public.security_events;

CREATE POLICY "Only admins can view security_events"
ON public.security_events
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Only admins can update security_events"
ON public.security_events
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Only admins can delete security_events"
ON public.security_events
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

-- Update the get_security_dashboard function to use the new admin check
CREATE OR REPLACE FUNCTION public.get_security_dashboard()
RETURNS TABLE(event_type text, severity security_event_severity, event_count bigint, unique_users bigint, first_occurrence timestamp with time zone, last_occurrence timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admin users to access this data using the new secure check
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    se.event_type,
    se.severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT se.user_email) as unique_users,
    MIN(se.created_at) as first_occurrence,
    MAX(se.created_at) as last_occurrence
  FROM public.security_events se
  WHERE se.created_at > (now() - INTERVAL '24 hours')
  GROUP BY se.event_type, se.severity
  ORDER BY 
    CASE se.severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
    END,
    COUNT(*) DESC;
END;
$function$;