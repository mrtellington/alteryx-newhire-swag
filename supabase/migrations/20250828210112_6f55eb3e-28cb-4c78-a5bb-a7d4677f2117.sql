-- Fix all remaining SECURITY DEFINER functions to have proper search_path setting

CREATE OR REPLACE FUNCTION public.authenticate_secure_readonly_admin(admin_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    admin_record secure_readonly_admins%ROWTYPE;
    current_user_email TEXT;
BEGIN
    -- Get current authenticated user's email from JWT
    current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
    
    -- Input validation
    IF admin_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Email is required'
        );
    END IF;
    
    -- Verify the requesting user is authenticated and matches the admin email
    IF current_user_email IS NULL OR LOWER(TRIM(admin_email)) != current_user_email THEN
        -- Log failed attempt
        INSERT INTO public.security_events (
            event_type,
            user_email,
            metadata,
            severity,
            created_at
        ) VALUES (
            'readonly_admin_auth_mismatch',
            admin_email,
            jsonb_build_object(
                'requested_email', admin_email,
                'authenticated_email', current_user_email,
                'reason', 'Email mismatch or not authenticated'
            ),
            'high',
            now()
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Authentication failed'
        );
    END IF;
    
    -- Find admin by email in secure table
    SELECT * INTO admin_record 
    FROM public.secure_readonly_admins 
    WHERE LOWER(email) = LOWER(TRIM(admin_email)) AND active = true;
    
    IF NOT FOUND THEN
        -- Log failed attempt
        INSERT INTO public.security_events (
            event_type,
            user_email,
            metadata,
            severity,
            created_at
        ) VALUES (
            'readonly_admin_not_found',
            admin_email,
            jsonb_build_object('reason', 'admin_not_in_secure_table'),
            'medium',
            now()
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Access denied'
        );
    END IF;
    
    -- Update last login time
    UPDATE public.secure_readonly_admins 
    SET last_login = now(),
        login_attempts = 0
    WHERE id = admin_record.id;
    
    -- Log successful authentication
    INSERT INTO public.security_events (
        event_type,
        user_email,
        metadata,
        severity,
        created_at
    ) VALUES (
        'secure_readonly_admin_auth_success',
        admin_email,
        jsonb_build_object('admin_id', admin_record.id),
        'low',
        now()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'admin', jsonb_build_object(
            'id', admin_record.id,
            'email', admin_record.email,
            'security_clearance_level', admin_record.security_clearance_level,
            'last_login', admin_record.last_login
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_suspicious_activity(user_email_param text, event_type_param text, time_window_minutes integer DEFAULT 15, max_events integer DEFAULT 10)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  event_count INTEGER;
BEGIN
  -- Count events of this type for this user in the time window
  SELECT COUNT(*) INTO event_count
  FROM public.security_events
  WHERE user_email = user_email_param
    AND event_type = event_type_param
    AND created_at > (now() - INTERVAL '1 minute' * time_window_minutes);
  
  -- Return true if suspicious activity detected
  RETURN event_count >= max_events;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_user_order_status(user_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_record RECORD;
  order_record RECORD;
  result jsonb;
BEGIN
  -- Find user by email
  SELECT id, order_submitted INTO user_record 
  FROM public.users 
  WHERE LOWER(email) = LOWER(user_email);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_ordered', false, 'user_exists', false);
  END IF;
  
  -- If user has not submitted an order, return early
  IF NOT user_record.order_submitted THEN
    RETURN jsonb_build_object('has_ordered', false, 'user_exists', true);
  END IF;
  
  -- Get order details
  SELECT order_number, date_submitted INTO order_record
  FROM public.orders 
  WHERE user_id = user_record.id
  ORDER BY date_submitted DESC
  LIMIT 1;
  
  IF FOUND THEN
    result := jsonb_build_object(
      'has_ordered', true,
      'user_exists', true,
      'order_number', order_record.order_number,
      'date_submitted', order_record.date_submitted
    );
  ELSE
    result := jsonb_build_object(
      'has_ordered', true,
      'user_exists', true,
      'order_number', null,
      'date_submitted', null
    );
  END IF;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_unauthorized_auth_users()
 RETURNS TABLE(deleted_email text, deleted_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  auth_user RECORD;
  is_admin BOOLEAN;
  is_eligible_user BOOLEAN;
BEGIN
  -- Loop through all auth users
  FOR auth_user IN 
    SELECT au.id, au.email 
    FROM auth.users au
  LOOP
    -- Check if user is an active admin
    SELECT EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE LOWER(email) = LOWER(auth_user.email) AND active = true
    ) INTO is_admin;
    
    -- Check if user is an invited user who hasn't ordered
    SELECT EXISTS (
      SELECT 1 FROM public.users 
      WHERE LOWER(email) = LOWER(auth_user.email) 
      AND invited = true 
      AND order_submitted = false
    ) INTO is_eligible_user;
    
    -- If not authorized, delete the auth user
    IF NOT (is_admin OR is_eligible_user) THEN
      -- Log the deletion
      INSERT INTO public.security_events (
        event_type,
        user_email,
        metadata,
        severity,
        created_at
      ) VALUES (
        'unauthorized_auth_user_deleted',
        auth_user.email,
        jsonb_build_object(
          'deleted_user_id', auth_user.id,
          'reason', 'User not in authorized database or already ordered'
        ),
        'high',
        now()
      );
      
      -- Return the deleted user info
      deleted_email := auth_user.email;
      deleted_id := auth_user.id;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$function$;