-- Add admin access policy for users table
-- Admins should be able to view all users in the admin dashboard

CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (public.is_user_admin());

-- Also allow admins to update any user profile (for admin management)
CREATE POLICY "Admins can update any user" 
ON public.users 
FOR UPDATE 
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());