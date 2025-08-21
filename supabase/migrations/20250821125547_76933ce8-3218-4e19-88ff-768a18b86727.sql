-- CRITICAL SECURITY FIX: Eliminate password hash exposure vulnerability
-- Instead of storing password hashes, we'll use a token-based approach with Supabase Auth

-- Step 1: Create a secure read-only admin table WITHOUT password hashes
CREATE TABLE IF NOT EXISTS public.secure_readonly_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  -- Instead of password_hash, we'll use magic link authentication
  last_login TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  -- Add additional security metadata
  allowed_ip_ranges JSONB DEFAULT '[]'::jsonb,
  security_clearance_level TEXT DEFAULT 'read_only'
);

-- Enable RLS on the new table
ALTER TABLE public.secure_readonly_admins ENABLE ROW LEVEL SECURITY;

-- Create ultra-restrictive RLS policies for the new table
CREATE POLICY "Only specific system admins can view secure_readonly_admins" 
ON public.secure_readonly_admins 
FOR SELECT 
USING (
  -- Only allow the two specific system admin emails
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
);

CREATE POLICY "Only specific system admins can insert secure_readonly_admins" 
ON public.secure_readonly_admins 
FOR INSERT 
WITH CHECK (
  -- Only allow the two specific system admin emails
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
);

CREATE POLICY "Only specific system admins can update secure_readonly_admins" 
ON public.secure_readonly_admins 
FOR UPDATE 
USING (
  -- Only allow the two specific system admin emails
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
)
WITH CHECK (
  -- Only allow the two specific system admin emails
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
);

-- Prevent deletion entirely
CREATE POLICY "No deletion allowed on secure_readonly_admins" 
ON public.secure_readonly_admins 
FOR DELETE 
USING (false);

-- Step 2: Create a secure function for read-only admin authentication
-- This function validates against Supabase Auth instead of custom password hashes
CREATE OR REPLACE FUNCTION public.authenticate_secure_readonly_admin(admin_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Step 3: Create function to check if user is secure read-only admin
CREATE OR REPLACE FUNCTION public.is_secure_readonly_admin(admin_email text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  check_email TEXT;
BEGIN
  -- Use provided email or get from JWT claims
  check_email := COALESCE(
    admin_email, 
    LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
  );
  
  -- Check if email exists in secure readonly admins table and is active
  RETURN EXISTS (
    SELECT 1 FROM public.secure_readonly_admins 
    WHERE LOWER(email) = check_email AND active = true
  );
END;
$$;

-- Step 4: Migrate existing data (if any) from old table to new secure table
-- But WITHOUT the password hashes - those are discarded for security
INSERT INTO public.secure_readonly_admins (email, active, created_at, created_by)
SELECT email, active, created_at, created_by
FROM public.read_only_admins
ON CONFLICT (email) DO NOTHING;

-- Step 5: Add critical security logging for the old table access
-- This will help us detect if anyone tries to access the old password hashes
CREATE OR REPLACE FUNCTION public.log_deprecated_admin_access()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log any access to the deprecated table with password hashes
  INSERT INTO public.security_events (
    event_type,
    user_email,
    metadata,
    severity,
    created_at
  ) VALUES (
    'CRITICAL_deprecated_password_table_access',
    LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)),
    jsonb_build_object(
      'operation', TG_OP,
      'table_name', 'read_only_admins',
      'warning', 'This table contains password hashes and should not be accessed',
      'recommendation', 'Use secure_readonly_admins table instead'
    ),
    'critical',
    now()
  );
  
  RETURN CASE 
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$;

-- Add trigger to monitor deprecated table access
DROP TRIGGER IF EXISTS log_deprecated_password_access ON public.read_only_admins;
CREATE TRIGGER log_deprecated_password_access
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.read_only_admins
  FOR EACH ROW EXECUTE FUNCTION public.log_deprecated_admin_access();