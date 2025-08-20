-- Update the is_user_admin function to only allow the specified three admin emails
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
  
  -- Only allow these three specific admin emails
  IF check_email = ANY(ARRAY['admin@whitestonebranding.com', 'dev@whitestonebranding.com', 'cecilia@whitestonebranding.com']) THEN
    RETURN true;
  END IF;
  
  -- No longer check admin_users table - only hardcoded admins allowed
  RETURN false;
END;
$function$;