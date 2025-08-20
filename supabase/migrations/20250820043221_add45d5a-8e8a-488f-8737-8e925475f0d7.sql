-- Fix admin_users security issue by removing circular dependency
-- Step 1: Drop all existing policies on admin_users
DROP POLICY IF EXISTS "Only admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can insert admin_users" ON public.admin_users; 
DROP POLICY IF EXISTS "Only admins can update admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "System admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "System admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "System admins can update admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "No admin user deletion allowed" ON public.admin_users;

-- Step 2: Create a secure function that checks against a hardcoded list of admin emails
-- This avoids the circular dependency issue entirely
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  current_email TEXT;
  admin_emails TEXT[] := ARRAY[
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com'
  ];
BEGIN
  -- Get current user email from JWT claims
  current_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Check if current email is in the admin whitelist
  RETURN current_email = ANY(admin_emails);
END;
$$;