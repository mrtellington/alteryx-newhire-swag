-- Update RLS policies to allow view_only admins to see users table
CREATE POLICY "View-only admins can view all users" 
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