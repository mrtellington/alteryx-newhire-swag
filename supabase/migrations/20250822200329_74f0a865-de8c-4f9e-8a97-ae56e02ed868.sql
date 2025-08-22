-- Create function to check if current user is a full admin (can write)
CREATE OR REPLACE FUNCTION public.is_full_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get current user email from JWT claims
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Check if user is an active admin with 'admin' role (not 'view_only')
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
$function$

-- Create function to get current user's admin role
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_email TEXT;
  user_role TEXT;
BEGIN
  -- Get current user email from JWT claims
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Get user's role
  SELECT role INTO user_role
  FROM public.admin_users 
  WHERE LOWER(email) = current_user_email
  AND active = true;
  
  RETURN COALESCE(user_role, 'none');
END;
$function$

-- Update existing functions to allow view-only access to read operations
-- The is_current_user_admin function already allows both admin and view_only roles for read access
-- We'll use is_full_admin for write operations