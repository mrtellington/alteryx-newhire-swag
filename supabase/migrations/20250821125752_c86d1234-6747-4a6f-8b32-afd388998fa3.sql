-- FINAL SECURITY FIX: Completely eliminate password hash storage
-- Drop the old table containing password hashes to fully resolve the security vulnerability

-- Step 1: Log the table removal for security audit
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'password_hash_table_eliminated',
  'tod.ellington@whitestonebranding.com',
  jsonb_build_object(
    'action', 'dropped_read_only_admins_table',
    'reason', 'eliminate_password_hash_security_vulnerability',
    'migration_to', 'secure_readonly_admins_with_supabase_auth'
  ),
  'critical',
  now()
);

-- Step 2: Drop all triggers and functions related to the old table first
DROP TRIGGER IF EXISTS log_deprecated_password_modifications ON public.read_only_admins;
DROP TRIGGER IF EXISTS monitor_admin_table_access ON public.read_only_admins;
DROP FUNCTION IF EXISTS public.log_deprecated_admin_access();

-- Step 3: Drop the old table completely - this eliminates the password hashes
DROP TABLE IF EXISTS public.read_only_admins CASCADE;

-- Step 4: Update functions that may have referenced the old table
-- Remove the old authenticate_readonly_admin function
DROP FUNCTION IF EXISTS public.authenticate_readonly_admin(text, text);

-- Remove the old is_readonly_admin function
DROP FUNCTION IF EXISTS public.is_readonly_admin(text);

-- Remove the old create_readonly_admin function
DROP FUNCTION IF EXISTS public.create_readonly_admin(text, text, text);

-- Step 5: Create an improved secure admin management function
CREATE OR REPLACE FUNCTION public.create_secure_readonly_admin(
  admin_email text,
  created_by_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_admin_id UUID;
    creator_email TEXT;
BEGIN
    -- Get current user email from JWT claims
    creator_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
    
    -- Verify creator is authorized (only specific system admins)
    IF creator_email NOT IN ('admin@whitestonebranding.com', 'tod.ellington@whitestonebranding.com') THEN
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
            (SELECT id FROM public.secure_readonly_admins WHERE email = creator_email LIMIT 1))
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

-- Step 6: Log the successful elimination of password hash vulnerability
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'security_vulnerability_eliminated',
  'tod.ellington@whitestonebranding.com',
  jsonb_build_object(
    'vulnerability', 'password_hash_exposure',
    'resolution', 'migrated_to_supabase_auth_magic_links',
    'old_system', 'custom_password_hashes_in_database',
    'new_system', 'secure_readonly_admins_with_supabase_auth',
    'security_improvement', 'eliminated_password_hash_storage_entirely'
  ),
  'low',
  now()
);