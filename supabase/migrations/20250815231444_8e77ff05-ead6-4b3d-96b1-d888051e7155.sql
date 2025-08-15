-- Create a security definer function to check admin status without RLS
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
    WHERE user_id = auth.uid() AND active = true
  );
$$;

-- Drop existing RLS policies that cause recursion
DROP POLICY IF EXISTS "Only admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Only admins can update admin_users" ON public.admin_users;

-- Create new policies using the security definer function
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