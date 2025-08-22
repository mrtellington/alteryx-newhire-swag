-- Fix admin_users security issue by removing circular dependency
-- The current get_current_user_admin_status() function creates a circular dependency
-- because it queries admin_users table while RLS policies on admin_users use this function

-- First, let's create a more secure approach using a whitelist of admin emails
-- This avoids the circular dependency issue

-- Create a secure function that checks against a hardcoded list of admin emails
-- This ensures no circular dependency and prevents unauthorized access
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  current_email TEXT;
  admin_emails TEXT[] := ARRAY[
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  ];
BEGIN
  -- Get current user email from JWT claims
  current_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Check if current email is in the admin whitelist
  RETURN current_email = ANY(admin_emails);
END;
$$;

-- Now update the RLS policies to use the new secure function
DROP POLICY IF EXISTS "Only admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can update admin_users" ON public.admin_users;

-- Create new restrictive policies using the secure function
CREATE POLICY "System admins can view admin_users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (public.is_system_admin());

CREATE POLICY "System admins can insert admin_users"
ON public.admin_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin());

CREATE POLICY "System admins can update admin_users"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Prevent deletion of admin users entirely for additional security
CREATE POLICY "No admin user deletion allowed"
ON public.admin_users
FOR DELETE
TO authenticated
USING (false);

-- Create a function to safely check admin status for other parts of the system
-- This one can be used by other tables without creating circular dependencies
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  current_email TEXT;
  is_admin_user BOOLEAN := false;
BEGIN
  -- First check if user is a system admin (hardcoded list)
  IF public.is_system_admin() THEN
    RETURN true;
  END IF;
  
  -- Then check admin_users table (this is safe because we're not in an RLS context for admin_users)
  current_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Use a direct query that bypasses RLS (safe because this function is SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = current_email AND active = true
  ) INTO is_admin_user;
  
  RETURN is_admin_user;
END;
$$;