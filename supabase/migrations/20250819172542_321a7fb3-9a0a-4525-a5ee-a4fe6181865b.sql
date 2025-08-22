-- Create a function to validate auth users before they can be created
CREATE OR REPLACE FUNCTION public.validate_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_admin BOOLEAN := false;
  is_eligible_user BOOLEAN := false;
BEGIN
  -- Check if user is an active admin
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = LOWER(NEW.email) AND active = true
  ) INTO is_admin;
  
  -- Check if user is an invited user who hasn't ordered
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE LOWER(email) = LOWER(NEW.email) 
    AND invited = true 
    AND order_submitted = false
  ) INTO is_eligible_user;
  
  -- Only allow if user is admin or eligible user
  IF NOT (is_admin OR is_eligible_user) THEN
    -- Log the rejected attempt
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'unauthorized_auth_attempt',
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'reason', 'User not in authorized database or already ordered'
      ),
      'high',
      now()
    );
    
    -- Reject the user creation
    RAISE EXCEPTION 'Access denied: User % is not authorized for authentication', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger to the auth.users table
DROP TRIGGER IF EXISTS validate_auth_user_trigger ON auth.users;
CREATE TRIGGER validate_auth_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_auth_user();