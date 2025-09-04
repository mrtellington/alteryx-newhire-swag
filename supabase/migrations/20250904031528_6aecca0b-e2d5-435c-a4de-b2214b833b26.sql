-- Drop the old restrictive admin policy and replace with the new inclusive one
DROP POLICY "Admins can view all users" ON public.users;

-- Update the existing view-only policy to be the main admin policy  
DROP POLICY "View-only admins can view all users" ON public.users;

-- Create a single comprehensive admin policy that covers both admin and view_only roles
CREATE POLICY "Admins and view-only admins can view all users" 
ON public.users 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
    AND active = true
    AND role IN ('admin', 'view_only')
  )
);