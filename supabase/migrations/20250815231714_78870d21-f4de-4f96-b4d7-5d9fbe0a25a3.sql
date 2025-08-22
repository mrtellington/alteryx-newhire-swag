-- Update admin_users table to use email-based checking instead of user_id
-- This allows admin access based on email domain validation

-- Drop the existing security definer function
DROP FUNCTION IF EXISTS public.get_current_user_admin_status();

-- Create a new security definer function that checks by email instead of user_id
CREATE OR REPLACE FUNCTION public.get_current_user_admin_status()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE LOWER(email) = LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
    AND active = true
  );
$$;