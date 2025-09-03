-- Step 1: Remove the overengineered auth validation trigger
DROP TRIGGER IF EXISTS validate_auth_user_permissive_trigger ON auth.users;

-- Step 2: Create a simple, single validation function
CREATE OR REPLACE FUNCTION public.validate_auth_user_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_authorized BOOLEAN := false;
BEGIN
  -- Simple check: Is user in admin_users OR users table?
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = LOWER(NEW.email) AND active = true
  ) OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE LOWER(email) = LOWER(NEW.email) AND invited = true
  ) INTO is_authorized;
  
  -- If not authorized, reject
  IF NOT is_authorized THEN
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'unauthorized_auth_attempt_simple',
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'reason', 'User not in authorized database'
      ),
      'high',
      now()
    );
    
    RAISE EXCEPTION 'Access denied: User % is not authorized', NEW.email;
  END IF;
  
  -- Log successful validation
  INSERT INTO public.security_events (
    event_type,
    user_email,
    metadata,
    severity,
    created_at
  ) VALUES (
    'auth_user_validated_simple',
    NEW.email,
    jsonb_build_object('user_id', NEW.id),
    'low',
    now()
  );
  
  RETURN NEW;
END;
$function$;

-- Step 3: Add the simple trigger back
CREATE TRIGGER validate_auth_user_simple_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_auth_user_simple();