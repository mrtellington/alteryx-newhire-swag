-- Fix the Security Definer View issue and improve function security
-- First drop the trigger, then the function, then recreate with proper security settings

-- Drop the trigger first
DROP TRIGGER IF EXISTS monitor_admin_table_access ON public.read_only_admins;

-- Now drop the function
DROP FUNCTION IF EXISTS public.log_admin_table_access();

-- Recreate the function with immutable search_path for security
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

-- Recreate the trigger
CREATE TRIGGER monitor_admin_table_access
  AFTER INSERT OR UPDATE OR DELETE ON public.read_only_admins
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_table_access();