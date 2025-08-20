-- Update the create_user_from_webhook function to automatically create auth users
CREATE OR REPLACE FUNCTION public.create_user_from_webhook(
  user_email text, 
  user_full_name text DEFAULT NULL::text, 
  user_first_name text DEFAULT NULL::text, 
  user_last_name text DEFAULT NULL::text, 
  user_shipping_address jsonb DEFAULT NULL::jsonb, 
  auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_user_id uuid;
  create_error jsonb := null;
  auth_user_result jsonb;
  created_auth_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO new_user_id FROM public.users WHERE email = user_email;
  
  IF FOUND THEN
    -- User already exists, update their information if needed
    UPDATE public.users 
    SET 
      full_name = COALESCE(user_full_name, users.full_name),
      first_name = COALESCE(user_first_name, users.first_name),
      last_name = COALESCE(user_last_name, users.last_name),
      shipping_address = COALESCE(user_shipping_address, users.shipping_address),
      auth_user_id = COALESCE(auth_user_id, users.auth_user_id),
      invited = true
    WHERE email = user_email
    RETURNING id INTO new_user_id;
    
    RETURN jsonb_build_object(
      'userId', new_user_id,
      'createError', null,
      'message', 'User updated successfully'
    );
  END IF;

  -- Validate email domain
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com' OR user_email = 'tod.ellington@gmail.com') THEN
    create_error := jsonb_build_object(
      'code', 'INVALID_DOMAIN',
      'message', 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed'
    );
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END IF;

  -- First create the user in public.users table
  BEGIN
    INSERT INTO public.users (
      email, 
      full_name,
      first_name,
      last_name,
      shipping_address, 
      invited,
      auth_user_id,
      created_at
    ) VALUES (
      user_email, 
      user_full_name,
      user_first_name,
      user_last_name,
      user_shipping_address, 
      true,
      auth_user_id,
      now()
    ) RETURNING id INTO new_user_id;
    
  EXCEPTION WHEN others THEN
    create_error := jsonb_build_object(
      'code', SQLSTATE,
      'message', SQLERRM
    );
    
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END;

  -- If no auth_user_id was provided, automatically create one
  IF auth_user_id IS NULL THEN
    -- Call the create-auth-users function to create auth account
    BEGIN
      SELECT content INTO auth_user_result 
      FROM net.http_post(
        url := (current_setting('app.settings.supabase_url', true) || '/functions/v1/create-auth-users'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('single_email', user_email)
      );
      
      -- Extract the created auth user ID from the response
      IF auth_user_result ? 'results' AND jsonb_array_length(auth_user_result->'results') > 0 THEN
        created_auth_user_id := (auth_user_result->'results'->0->>'auth_user_id')::uuid;
        
        -- Update the user record with the new auth_user_id
        UPDATE public.users 
        SET auth_user_id = created_auth_user_id 
        WHERE id = new_user_id;
      END IF;
      
    EXCEPTION WHEN others THEN
      -- Log the error but don't fail the user creation
      RAISE NOTICE 'Failed to auto-create auth user for %: %', user_email, SQLERRM;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'userId', new_user_id,
    'createError', null,
    'message', 'User created successfully'
  );
END;
$function$;