-- Step 3: Create new restrictive policies using the secure function
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

-- Step 4: Create a function to safely check admin status for other parts of the system
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