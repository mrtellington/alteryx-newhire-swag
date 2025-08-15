-- Drop existing RLS policies first
DROP POLICY IF EXISTS "Only admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can update admin_users" ON public.admin_users;

-- Drop and recreate the security definer function to use email-based checking
DROP FUNCTION IF EXISTS public.get_current_user_admin_status();

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

-- Recreate the policies using the updated function
CREATE POLICY "Only admins can view admin_users" 
ON public.admin_users 
FOR SELECT 
USING (public.get_current_user_admin_status());

CREATE POLICY "Only admins can insert admin_users" 
ON public.admin_users 
FOR INSERT 
WITH CHECK (public.get_current_user_admin_status());

CREATE POLICY "Only admins can update admin_users" 
ON public.admin_users 
FOR UPDATE 
USING (public.get_current_user_admin_status())
WITH CHECK (public.get_current_user_admin_status());