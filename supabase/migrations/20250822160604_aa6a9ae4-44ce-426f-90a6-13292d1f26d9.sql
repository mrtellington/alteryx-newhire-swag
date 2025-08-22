-- Clean up all hardcoded emails from database functions and add cecilia as admin

-- Update is_current_user_admin function to check ONLY admin_users table
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get current user email from JWT claims
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Check if user is a dashboard admin (in admin_users table ONLY)
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = current_user_email
    AND active = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update create_secure_readonly_admin to check admin_users table instead of hardcoded emails
CREATE OR REPLACE FUNCTION public.create_secure_readonly_admin(admin_email text, created_by_email text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    
    -- Check if admin already exists
    IF EXISTS (SELECT 1 FROM public.secure_readonly_admins WHERE LOWER(email) = LOWER(TRIM(admin_email))) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Read-only admin already exists'
        );
    END IF;
    
    -- Insert new secure admin (no password hash needed)
    INSERT INTO public.secure_readonly_admins (email, created_by)
    VALUES (LOWER(TRIM(admin_email)), 
            (SELECT id FROM public.admin_users WHERE LOWER(email) = creator_email LIMIT 1))
    RETURNING id INTO new_admin_id;
    
    -- Log creation
    INSERT INTO public.security_events (
        event_type,
        user_email,
        metadata,
        severity,
        created_at
    ) VALUES (
        'secure_readonly_admin_created',
        admin_email,
        jsonb_build_object(
            'admin_id', new_admin_id, 
            'created_by', creator_email,
            'security_method', 'supabase_auth_magic_link'
        ),
        'medium',
        now()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'admin_id', new_admin_id,
        'message', 'Secure read-only admin created successfully - they can now login with magic link'
    );
END;
$$;

-- Update get_auth_users_to_clean to get admin emails from admin_users table
CREATE OR REPLACE FUNCTION public.get_auth_users_to_clean()
RETURNS TABLE(email text, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    admin_emails TEXT[];
BEGIN
    -- Get admin emails from admin_users table instead of hardcoded
    SELECT ARRAY(
        SELECT admin_users.email 
        FROM public.admin_users 
        WHERE active = true
    ) INTO admin_emails;
    
    -- Log that cleanup function was called
    INSERT INTO public.security_events (
        event_type,
        metadata,
        severity,
        created_at
    ) VALUES (
        'auth_cleanup_function_called',
        jsonb_build_object(
            'admin_emails_to_preserve', admin_emails
        ),
        'medium',
        now()
    );
    
    -- Return placeholder data - the actual cleanup will be done by the cleanup function
    RETURN QUERY SELECT 
        'cleanup_needed'::text as email,
        'use_cleanup_function'::text as reason;
END;
$$;

-- Update is_user_admin to check admin_users table only
CREATE OR REPLACE FUNCTION public.is_user_admin(user_email text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  check_email TEXT;
BEGIN
  -- Use provided email or get from JWT claims
  check_email := COALESCE(
    user_email, 
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
  );
  
  -- Check admin_users table only
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE LOWER(email) = check_email AND active = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Add cecilia@whitestonebranding.com to admin_users table
INSERT INTO public.admin_users (email, full_name, active, role)
VALUES ('cecilia@whitestonebranding.com', 'Cecilia', true, 'admin')
ON CONFLICT (email) DO UPDATE SET
  active = true,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Ensure dev@whitestonebranding.com is NOT in admin_users table
DELETE FROM public.admin_users WHERE LOWER(email) = 'dev@whitestonebranding.com';