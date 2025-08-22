-- Fix the create_user_from_webhook function to handle null shipping addresses
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
  existing_user_id uuid;
  safe_shipping_address jsonb;
BEGIN
  -- Input validation and sanitization
  user_email := LOWER(TRIM(user_email));
  
  -- Handle null shipping address by providing empty object
  safe_shipping_address := COALESCE(user_shipping_address, '{}'::jsonb);
  
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'userId', null,
      'createError', jsonb_build_object(
        'code', 'INVALID_EMAIL',
        'message', 'Email is required and cannot be empty'
      )
    );
  END IF;

  -- Validate email format
  IF NOT user_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'userId', null,
      'createError', jsonb_build_object(
        'code', 'INVALID_EMAIL_FORMAT',
        'message', 'Invalid email format'
      )
    );
  END IF;

  -- Validate email domain
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com') THEN
    create_error := jsonb_build_object(
      'code', 'INVALID_DOMAIN',
      'message', 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed'
    );
    
    -- Log invalid domain attempt
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'webhook_invalid_domain_attempt',
      user_email,
      jsonb_build_object('email_domain', SPLIT_PART(user_email, '@', 2)),
      'medium',
      now()
    );
    
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END IF;

  -- Start transaction logic
  BEGIN
    -- Check if user already exists
    SELECT id INTO existing_user_id FROM public.users WHERE email = user_email;
    
    IF FOUND THEN
      -- User exists, update their information if needed
      UPDATE public.users 
      SET 
        full_name = COALESCE(user_full_name, public.users.full_name),
        first_name = COALESCE(user_first_name, public.users.first_name),
        last_name = COALESCE(user_last_name, public.users.last_name),
        shipping_address = COALESCE(safe_shipping_address, public.users.shipping_address),
        auth_user_id = COALESCE(create_user_from_webhook.auth_user_id, public.users.auth_user_id),
        invited = true
      WHERE email = user_email
      RETURNING id INTO new_user_id;
      
      -- Log user update
      INSERT INTO public.security_events (
        event_type,
        user_email,
        metadata,
        severity,
        created_at
      ) VALUES (
        'user_updated_via_webhook',
        user_email,
        jsonb_build_object(
          'user_id', new_user_id,
          'auth_user_id', create_user_from_webhook.auth_user_id
        ),
        'low',
        now()
      );
      
      RETURN jsonb_build_object(
        'userId', new_user_id,
        'createError', null,
        'message', 'User updated successfully',
        'action', 'updated'
      );
    END IF;

    -- Create new user with safe shipping address
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
      safe_shipping_address,  -- Use the safe version that's never null
      true,
      create_user_from_webhook.auth_user_id,
      now()
    ) RETURNING id INTO new_user_id;
    
    -- Log user creation
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'user_created_via_webhook',
      user_email,
      jsonb_build_object(
        'user_id', new_user_id,
        'auth_user_id', create_user_from_webhook.auth_user_id,
        'has_shipping_address', user_shipping_address IS NOT NULL
      ),
      'low',
      now()
    );
    
    RETURN jsonb_build_object(
      'userId', new_user_id,
      'createError', null,
      'message', 'User created successfully',
      'action', 'created'
    );
    
  EXCEPTION WHEN others THEN
    -- Log the error
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'webhook_user_creation_error',
      user_email,
      jsonb_build_object(
        'error_code', SQLSTATE,
        'error_message', SQLERRM
      ),
      'high',
      now()
    );
    
    create_error := jsonb_build_object(
      'code', SQLSTATE,
      'message', SQLERRM
    );
    
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END;
END;
$function$;