-- Fix the is_user_admin function to only return true for full admins
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
  
  -- Check admin_users table only for FULL ADMINS (role = 'admin')
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE LOWER(email) = check_email AND active = true AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update is_current_user_admin to also check for full admin role only
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get current user email from JWT claims
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Check if user is a dashboard admin with full admin role only
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = current_user_email
    AND active = true
    AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;