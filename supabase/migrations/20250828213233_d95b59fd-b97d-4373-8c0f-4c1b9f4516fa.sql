-- Continue fixing remaining functions, but skip the secure_readonly_admins function since that table doesn't exist

-- Get remaining functions that need search_path fix (excluding the problematic one)
CREATE OR REPLACE FUNCTION public.create_secure_readonly_admin(admin_email text, created_by_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    new_admin_id UUID;
    creator_email TEXT;
BEGIN
    -- Get current user email from JWT claims
    creator_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
    
    -- Verify creator is authorized (check admin_users table)
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE LOWER(email) = creator_email AND active = true
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only system administrators can create read-only admins'
        );
    END IF;
    
    -- Input validation
    IF admin_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Email is required'
        );
    END IF;
    
    -- Validate email domain (same security as user creation)
    IF NOT (admin_email LIKE '%@alteryx.com' OR admin_email LIKE '%@whitestonebranding.com') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid email domain - must be @alteryx.com or @whitestonebranding.com'
        );
    END IF;
    
    -- This function is a placeholder - the secure_readonly_admins table doesn't exist
    -- Return success but indicate feature not implemented
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Secure readonly admin feature not yet implemented'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_secure_readonly_admin(admin_email text DEFAULT NULL::text)
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
    admin_email, 
    LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
  );
  
  -- Since secure_readonly_admins table doesn't exist, return false
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_user_from_webhook(user_email text, user_full_name text DEFAULT NULL::text, user_first_name text DEFAULT NULL::text, user_last_name text DEFAULT NULL::text, user_shipping_address jsonb DEFAULT NULL::jsonb, auth_user_id uuid DEFAULT NULL::uuid, order_number text DEFAULT NULL::text, order_date text DEFAULT NULL::text)
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
  parsed_order_date timestamp with time zone;
  new_order_id uuid;
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

  -- Parse order date if provided
  IF order_date IS NOT NULL AND order_date != '' THEN
    BEGIN
      -- Try to parse the date (handle various formats)
      parsed_order_date := order_date::timestamp with time zone;
    EXCEPTION WHEN others THEN
      -- Try parsing as MM/DD/YYYY format
      BEGIN
        parsed_order_date := TO_TIMESTAMP(order_date, 'MM/DD/YYYY')::timestamp with time zone;
      EXCEPTION WHEN others THEN
        RETURN jsonb_build_object(
          'userId', null,
          'createError', jsonb_build_object(
            'code', 'INVALID_DATE_FORMAT',
            'message', 'Invalid order date format. Use MM/DD/YYYY or YYYY-MM-DD'
          )
        );
      END;
    END;
  END IF;

  -- Start transaction logic
  BEGIN
    -- Check if user already exists
    SELECT id INTO existing_user_id FROM public.users WHERE email = user_email;
    
    IF FOUND THEN
      -- User exists, update their information
      UPDATE public.users 
      SET 
        full_name = COALESCE(user_full_name, public.users.full_name),
        first_name = COALESCE(user_first_name, public.users.first_name),
        last_name = COALESCE(user_last_name, public.users.last_name),
        shipping_address = COALESCE(safe_shipping_address, public.users.shipping_address),
        auth_user_id = COALESCE(create_user_from_webhook.auth_user_id, public.users.auth_user_id),
        invited = true,
        order_submitted = CASE 
          WHEN order_number IS NOT NULL AND order_number != '' THEN true 
          ELSE public.users.order_submitted 
        END
      WHERE email = user_email
      RETURNING id INTO new_user_id;
      
      -- Create order if order data provided and no existing order
      IF order_number IS NOT NULL AND order_number != '' THEN
        -- Check if order already exists for this user
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE user_id = new_user_id AND order_number = create_user_from_webhook.order_number) THEN
          INSERT INTO public.orders (
            user_id,
            order_number,
            date_submitted,
            status
          ) VALUES (
            new_user_id,
            create_user_from_webhook.order_number,
            COALESCE(parsed_order_date, now()),
            'completed'
          ) RETURNING id INTO new_order_id;
        END IF;
      END IF;
      
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
          'auth_user_id', create_user_from_webhook.auth_user_id,
          'has_order', order_number IS NOT NULL,
          'order_id', new_order_id
        ),
        'low',
        now()
      );
      
      RETURN jsonb_build_object(
        'userId', new_user_id,
        'createError', null,
        'message', 'User updated successfully',
        'action', 'updated',
        'orderId', new_order_id
      );
    END IF;

    -- Create new user
    INSERT INTO public.users (
      email, 
      full_name,
      first_name,
      last_name,
      shipping_address, 
      invited,
      auth_user_id,
      order_submitted,
      created_at
    ) VALUES (
      user_email, 
      user_full_name,
      user_first_name,
      user_last_name,
      safe_shipping_address,
      true,
      create_user_from_webhook.auth_user_id,
      CASE WHEN order_number IS NOT NULL AND order_number != '' THEN true ELSE false END,
      now()
    ) RETURNING id INTO new_user_id;
    
    -- Create order if order data provided
    IF order_number IS NOT NULL AND order_number != '' THEN
      INSERT INTO public.orders (
        user_id,
        order_number,
        date_submitted,
        status
      ) VALUES (
        new_user_id,
        create_user_from_webhook.order_number,
        COALESCE(parsed_order_date, now()),
        'completed'
      ) RETURNING id INTO new_order_id;
    END IF;
    
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
        'has_shipping_address', user_shipping_address IS NOT NULL,
        'has_order', order_number IS NOT NULL,
        'order_id', new_order_id
      ),
      'low',
      now()
    );
    
    RETURN jsonb_build_object(
      'userId', new_user_id,
      'createError', null,
      'message', 'User created successfully',
      'action', 'created',
      'orderId', new_order_id
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