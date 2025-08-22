-- Update the is_user_admin function to use the new secure approach
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
  
  -- First check system admin list
  IF check_email = ANY(ARRAY['admin@whitestonebranding.com', 'tod.ellington@whitestonebranding.com']) THEN
    RETURN true;
  END IF;
  
  -- Then check admin_users table
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE lower(email) = lower(check_email) AND active = true
  );
END;
$$;

-- Update any policies that might be using the old function name
-- First check if we need to update any other table policies