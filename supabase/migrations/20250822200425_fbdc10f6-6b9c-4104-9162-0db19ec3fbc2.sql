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