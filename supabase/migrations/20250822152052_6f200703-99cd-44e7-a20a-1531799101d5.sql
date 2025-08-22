-- Update is_current_user_admin function to check both users and admin_users tables
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
  
  -- Check if user is a system admin (in users table)
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND email IN (
      'admin@whitestonebranding.com',
      'tod.ellington@whitestonebranding.com',
      'dev@whitestonebranding.com'
    )
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is a dashboard admin (in admin_users table)
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = current_user_email
    AND active = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;