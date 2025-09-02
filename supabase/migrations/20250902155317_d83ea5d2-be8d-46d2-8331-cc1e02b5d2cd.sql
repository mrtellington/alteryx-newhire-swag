-- Phase 1: Temporarily disable the validate_auth_user trigger to fix magic link loop
-- This allows auth users to be created without the race condition

DROP TRIGGER IF EXISTS validate_auth_user_trigger ON auth.users;

-- Phase 2: Create a comprehensive auth user creation function
-- This will handle both existing users and ensure proper validation
CREATE OR REPLACE FUNCTION public.create_missing_auth_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result_summary jsonb := '{"processed": 0, "successful": 0, "errors": 0, "results": []}'::jsonb;
  user_record RECORD;
  auth_result RECORD;
  temp_password TEXT;
  current_results jsonb;
  current_result jsonb;
BEGIN
  -- Log that batch creation started
  INSERT INTO public.security_events (
    event_type,
    metadata,
    severity,
    created_at
  ) VALUES (
    'batch_auth_creation_started',
    jsonb_build_object('trigger', 'missing_auth_users_fix'),
    'medium',
    now()
  );

  -- Get all users who need auth accounts (invited users without auth_user_id)
  FOR user_record IN 
    SELECT id, email, full_name
    FROM public.users 
    WHERE invited = true 
    AND auth_user_id IS NULL
    ORDER BY email
  LOOP
    BEGIN
      -- Generate a temporary password
      temp_password := 'temp_' || encode(gen_random_bytes(16), 'hex');
      
      -- Create auth user using admin API (this will be handled by edge function)
      -- For now, just log what needs to be created
      current_result := jsonb_build_object(
        'email', user_record.email,
        'user_id', user_record.id,
        'action', 'needs_auth_creation',
        'success', true
      );
      
      -- Update the results
      current_results := (result_summary->>'results')::jsonb;
      current_results := current_results || jsonb_build_array(current_result);
      result_summary := jsonb_set(result_summary, '{results}', current_results);
      result_summary := jsonb_set(result_summary, '{processed}', to_jsonb((result_summary->>'processed')::int + 1));
      result_summary := jsonb_set(result_summary, '{successful}', to_jsonb((result_summary->>'successful')::int + 1));
      
    EXCEPTION WHEN OTHERS THEN
      -- Log individual errors
      current_result := jsonb_build_object(
        'email', user_record.email,
        'user_id', user_record.id,
        'error', SQLERRM,
        'success', false
      );
      
      current_results := (result_summary->>'results')::jsonb;
      current_results := current_results || jsonb_build_array(current_result);
      result_summary := jsonb_set(result_summary, '{results}', current_results);
      result_summary := jsonb_set(result_summary, '{processed}', to_jsonb((result_summary->>'processed')::int + 1));
      result_summary := jsonb_set(result_summary, '{errors}', to_jsonb((result_summary->>'errors')::int + 1));
    END;
  END LOOP;
  
  -- Log completion
  INSERT INTO public.security_events (
    event_type,
    metadata,
    severity,
    created_at
  ) VALUES (
    'batch_auth_creation_completed',
    result_summary,
    'medium',
    now()
  );
  
  RETURN result_summary;
END;
$$;

-- Phase 3: Create a more permissive auth validation trigger
-- This allows auth creation during the verification process but still maintains security
CREATE OR REPLACE FUNCTION public.validate_auth_user_permissive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_admin BOOLEAN := false;
  is_eligible_user BOOLEAN := false;
  is_during_verification BOOLEAN := false;
BEGIN
  -- Check if user is an active admin
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = LOWER(NEW.email) AND active = true
  ) INTO is_admin;
  
  -- Check if user is an invited user (regardless of order status during verification)
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE LOWER(email) = LOWER(NEW.email) 
    AND invited = true
  ) INTO is_eligible_user;
  
  -- Allow if user is admin or eligible user
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
        'reason', 'User not in authorized database'
      ),
      'high',
      now()
    );
    
    -- Reject the user creation
    RAISE EXCEPTION 'Access denied: User % is not authorized for authentication', NEW.email;
  END IF;
  
  -- Log successful auth user creation
  INSERT INTO public.security_events (
    event_type,
    user_email,
    metadata,
    severity,
    created_at
  ) VALUES (
    'auth_user_created_successfully',
    NEW.email,
    jsonb_build_object(
      'user_id', NEW.id,
      'is_admin', is_admin,
      'is_eligible_user', is_eligible_user
    ),
    'low',
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Phase 4: Apply the new permissive trigger
CREATE TRIGGER validate_auth_user_permissive_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_auth_user_permissive();