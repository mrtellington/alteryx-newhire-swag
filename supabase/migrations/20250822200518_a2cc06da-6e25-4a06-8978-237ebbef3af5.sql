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