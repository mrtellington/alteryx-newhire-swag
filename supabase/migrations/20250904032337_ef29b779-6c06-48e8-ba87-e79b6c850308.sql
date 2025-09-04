-- The issue is that both SELECT policies must be true (AND logic)
-- We need to make the policies work with OR logic instead

-- Drop the existing admin policy
DROP POLICY "Admins and view-only admins can view all users" ON public.users;

-- Create a new PERMISSIVE policy that allows admin access OR user profile access
CREATE POLICY "Admin or own profile access" 
ON public.users 
FOR SELECT
USING (
  -- Admin access (both admin and view_only roles)
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
    AND active = true
    AND role IN ('admin', 'view_only')
  )
  OR
  -- Own profile access
  (auth.uid() = auth_user_id)
);