-- Update other tables that were using the old get_current_user_admin_status function
-- to use the new is_current_user_admin function

-- Update users table policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;

CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update any user" 
ON public.users 
FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Update orders table policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;

CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update all orders" 
ON public.orders 
FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Update security_events table policies
DROP POLICY IF EXISTS "Only admins can view security_events" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can update security_events" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can delete security_events" ON public.security_events;
DROP POLICY IF EXISTS "Admins can view security dashboard" ON public.security_events;

CREATE POLICY "Only admins can view security_events" 
ON public.security_events 
FOR SELECT 
USING (public.is_current_user_admin());

CREATE POLICY "Only admins can update security_events" 
ON public.security_events 
FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Only admins can delete security_events" 
ON public.security_events 
FOR DELETE 
USING (public.is_current_user_admin());

-- Also update any database functions that were using the old function
-- Update is_user_admin function to use the new approach
CREATE OR REPLACE FUNCTION public.is_user_admin(user_email text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  check_email TEXT;
BEGIN
  -- Use provided email or get from JWT claims
  check_email := COALESCE(
    user_email, 
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
  );
  
  -- Use the new secure function approach
  RETURN public.is_current_user_admin();
END;
$$;