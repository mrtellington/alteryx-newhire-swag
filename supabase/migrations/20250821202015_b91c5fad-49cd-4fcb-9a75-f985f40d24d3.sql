-- Fix admin configuration: Remove tod.ellington from admin_users table
-- They should be a regular user, not an admin
DELETE FROM public.admin_users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Add tod.ellington as a regular user in the users table
-- They need to be able to place orders like other regular users
INSERT INTO public.users (
  email,
  full_name,
  invited,
  order_submitted,
  created_at
) VALUES (
  'tod.ellington@whitestonebranding.com',
  'Tod Ellington',
  true,
  false,
  now()
);

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
$function$

-- Log this configuration fix for security tracking
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'admin_configuration_fixed',
  'tod.ellington@whitestonebranding.com',
  jsonb_build_object(
    'action', 'removed_from_admin_users_and_added_to_users',
    'reason', 'tod.ellington_should_be_regular_user_not_admin',
    'correct_admins', ARRAY['admin@whitestonebranding.com', 'dev@whitestonebranding.com', 'cecilia@whitestonebranding.com']
  ),
  'medium',
  now()
);