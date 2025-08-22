-- Step 1: Clean slate - Remove all standard users (keep only admins)
-- First, identify admin emails
DO $$
DECLARE
    admin_emails TEXT[] := ARRAY[
        'admin@whitestonebranding.com',
        'dev@whitestonebranding.com', 
        'cecilia@whitestonebranding.com'
    ];
    user_record RECORD;
    auth_user_record RECORD;
BEGIN
    -- Log the cleanup start
    INSERT INTO public.security_events (
        event_type,
        metadata,
        severity,
        created_at
    ) VALUES (
        'database_cleanup_started',
        jsonb_build_object(
            'action', 'remove_all_standard_users',
            'admin_emails_preserved', admin_emails
        ),
        'medium',
        now()
    );

    -- Delete all non-admin users from the users table
    DELETE FROM public.users 
    WHERE email != ALL(admin_emails);

    -- Get admin user IDs to preserve in auth
    CREATE TEMP TABLE admin_auth_ids AS
    SELECT DISTINCT u.auth_user_id 
    FROM public.users u 
    WHERE u.auth_user_id IS NOT NULL;

    -- Note: We cannot directly delete from auth.users via SQL
    -- This will need to be handled by the cleanup function

    -- Log completion
    INSERT INTO public.security_events (
        event_type,
        metadata,
        severity,
        created_at
    ) VALUES (
        'database_cleanup_completed',
        jsonb_build_object(
            'action', 'removed_standard_users',
            'remaining_users_count', (SELECT COUNT(*) FROM public.users)
        ),
        'medium',
        now()
    );
END $$;

-- Step 2: Remove unused edge functions and triggers
-- Drop the problematic functions
DROP FUNCTION IF EXISTS public.auto_create_auth_user_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_auth_creation() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 3: Create automatic auth creation trigger using cognito-webhook
CREATE OR REPLACE FUNCTION public.trigger_auth_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger for invited users without auth_user_id
  IF NEW.invited = true AND NEW.auth_user_id IS NULL THEN
    -- Log that we need to create an auth user automatically
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'auto_auth_creation_needed',
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'trigger_reason', 'new_user_without_auth'
      ),
      'low',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic auth creation logging
DROP TRIGGER IF EXISTS auto_auth_creation_trigger ON public.users;
CREATE TRIGGER auto_auth_creation_trigger
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auth_creation();

-- Step 4: Enhance the create_user_from_webhook function for better reliability
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
AS $$
DECLARE
  new_user_id uuid;
  create_error jsonb := null;
  existing_user_id uuid;
BEGIN
  -- Input validation and sanitization
  user_email := LOWER(TRIM(user_email));
  
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
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com' OR user_email = 'tod.ellington@gmail.com') THEN
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
        full_name = COALESCE(user_full_name, users.full_name),
        first_name = COALESCE(user_first_name, users.first_name),
        last_name = COALESCE(user_last_name, users.last_name),
        shipping_address = COALESCE(user_shipping_address, users.shipping_address),
        auth_user_id = COALESCE(auth_user_id, users.auth_user_id),
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
          'auth_user_id', auth_user_id
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

    -- Create new user
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
        'auth_user_id', auth_user_id,
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
$$;