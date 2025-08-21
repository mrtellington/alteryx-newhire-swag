-- Fix the Security Definer View issue and improve function security
-- Drop the problematic view that was flagged as a security risk
DROP VIEW IF EXISTS public.safe_admin_view;

-- Update the trigger function to have immutable search_path for security
DROP FUNCTION IF EXISTS public.log_admin_table_access();
CREATE OR REPLACE FUNCTION public.log_admin_table_access()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;