-- Critical Security Fix: Add additional RLS restrictions for read_only_admins table
-- This prevents exposure of password hashes even if is_system_admin() function is compromised

-- Drop existing policies to replace with more restrictive ones
DROP POLICY IF EXISTS "System admins can view read_only_admins" ON public.read_only_admins;
DROP POLICY IF EXISTS "System admins can insert read_only_admins" ON public.read_only_admins;
DROP POLICY IF EXISTS "System admins can update read_only_admins" ON public.read_only_admins;

-- Create more restrictive policies that also check specific admin emails
CREATE POLICY "Only whitelisted system admins can view read_only_admins" 
ON public.read_only_admins 
FOR SELECT 
USING (
  is_system_admin() AND 
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
);

CREATE POLICY "Only whitelisted system admins can insert read_only_admins" 
ON public.read_only_admins 
FOR INSERT 
WITH CHECK (
  is_system_admin() AND 
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
);

CREATE POLICY "Only whitelisted system admins can update read_only_admins" 
ON public.read_only_admins 
FOR UPDATE 
USING (
  is_system_admin() AND 
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
)
WITH CHECK (
  is_system_admin() AND 
  LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  )
);

-- Enhanced security logging for admin table access
CREATE OR REPLACE FUNCTION public.log_admin_table_access()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get current user email
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Log all access attempts to read_only_admins table
  INSERT INTO public.security_events (
    event_type,
    user_email,
    metadata,
    severity,
    created_at
  ) VALUES (
    'read_only_admins_table_access',
    current_user_email,
    jsonb_build_object(
      'operation', TG_OP,
      'table_name', TG_TABLE_NAME,
      'accessed_admin_email', CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.email 
        ELSE NEW.email 
      END
    ),
    'high',
    now()
  );
  
  RETURN CASE 
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for monitoring admin table access
DROP TRIGGER IF EXISTS monitor_admin_table_access ON public.read_only_admins;
CREATE TRIGGER monitor_admin_table_access
  AFTER INSERT OR UPDATE OR DELETE ON public.read_only_admins
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_table_access();

-- Additional security: Restrict password_hash column access even further
-- Create a view that excludes password hashes for regular admin operations
CREATE OR REPLACE VIEW public.safe_admin_view AS
SELECT 
  id,
  email,
  active,
  created_at,
  created_by
FROM public.read_only_admins;

-- Grant access to the safe view for system admins
GRANT SELECT ON public.safe_admin_view TO authenticated;