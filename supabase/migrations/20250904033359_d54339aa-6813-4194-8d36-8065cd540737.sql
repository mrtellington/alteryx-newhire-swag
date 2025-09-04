-- Create a new safer RLS policy for users table that uses the working get_admin_role() function
-- This replaces the complex JWT parsing with a simpler, more reliable approach

-- First, create the new policy alongside the existing one for testing
CREATE POLICY "Admins and users can access users table v2" ON public.users
FOR SELECT USING (
  public.get_admin_role() IN ('admin', 'view_only') OR auth.uid() = auth_user_id
);

-- Create a debugging function to test policy evaluation
CREATE OR REPLACE FUNCTION public.debug_user_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_email TEXT;
  current_role TEXT;
  current_auth_uid UUID;
  user_count INTEGER;
BEGIN
  -- Get current user info
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  current_auth_uid := auth.uid();
  current_role := public.get_admin_role();
  
  -- Count users that should be accessible
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  RETURN jsonb_build_object(
    'current_user_email', current_user_email,
    'current_auth_uid', current_auth_uid,
    'current_role', current_role,
    'total_user_count', user_count,
    'should_have_access', current_role IN ('admin', 'view_only'),
    'timestamp', now()
  );
END;
$$;