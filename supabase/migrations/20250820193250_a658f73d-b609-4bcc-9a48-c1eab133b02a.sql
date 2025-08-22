-- Fix the ambiguous column reference in create_user_from_webhook function
CREATE OR REPLACE FUNCTION public.create_user_from_webhook(user_email text, user_full_name text DEFAULT NULL::text, user_first_name text DEFAULT NULL::text, user_last_name text DEFAULT NULL::text, user_shipping_address jsonb DEFAULT NULL::jsonb, auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  new_user_id uuid;
  create_error jsonb := null;
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

  -- Create the user in public.users table
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
    
    RETURN jsonb_build_object(
      'userId', new_user_id,
      'createError', null,
      'message', 'User created successfully'
    );
    
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
END;
$$;