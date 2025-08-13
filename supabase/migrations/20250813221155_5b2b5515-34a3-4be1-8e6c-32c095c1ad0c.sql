-- Fix RLS policy to ensure users can only view their own profile data
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view their own profile if invited and allowed domain" ON public.users;

-- Create a more restrictive policy that only allows users to view their own profile
CREATE POLICY "Users can view only their own profile" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND invited = true 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR 
    (auth_user_id IS NULL AND auth.uid() = id)
  )
  AND (
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) LIKE '%@alteryx.com'
    OR 
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) LIKE '%@whitestonebranding.com'
  )
);