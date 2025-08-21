-- Update the is_system_admin function to only include the correct admins
-- Remove tod.ellington from the hardcoded admin list
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_email TEXT;
  admin_emails TEXT[] := ARRAY[
    'admin@whitestonebranding.com',
    'dev@whitestonebranding.com',
    'cecilia@whitestonebranding.com'
  ];
BEGIN
  -- Get current user email from JWT claims (with proper error handling)
  BEGIN
    current_email := LOWER(TRIM(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)));
  EXCEPTION WHEN OTHERS THEN
    -- If we can't get email from JWT, definitely not an admin
    RETURN false;
  END;
  
  -- Return false if email is null or empty
  IF current_email IS NULL OR current_email = '' THEN
    RETURN false;
  END IF;
  
  -- Check if current email is in the admin whitelist (tod.ellington removed)
  RETURN current_email = ANY(admin_emails);
END;
$function$;