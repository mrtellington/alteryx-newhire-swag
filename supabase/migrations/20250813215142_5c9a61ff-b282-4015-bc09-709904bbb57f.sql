-- Fix the create_user_from_webhook function to use correct exception variables
DROP FUNCTION IF EXISTS public.create_user_from_webhook(text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_user_from_webhook(
  user_email text, 
  user_full_name text DEFAULT NULL, 
  user_shipping_address jsonb DEFAULT NULL
) RETURNS jsonb
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
      shipping_address = COALESCE(user_shipping_address, users.shipping_address),
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
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com') THEN
    create_error := jsonb_build_object(
      'code', 'INVALID_DOMAIN',
      'message', 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed'
    );
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END IF;

  -- Generate a new UUID for the user (not tied to auth.users)
  new_user_id := gen_random_uuid();

  -- Create new user in public.users table
  BEGIN
    INSERT INTO public.users (
      id,
      email, 
      full_name, 
      shipping_address, 
      invited,
      created_at
    ) VALUES (
      new_user_id,
      user_email, 
      user_full_name, 
      user_shipping_address, 
      true,
      now()
    );
    
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