-- Add INSERT policy for users table to prevent unauthorized user creation
-- This policy ensures only authenticated users with valid email domains can create their own user record

CREATE POLICY "Users can insert their own profile if authenticated and invited" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User can only insert their own record
  auth.uid() = id 
  AND 
  -- Must be invited (prevents random signups)
  invited = true 
  AND 
  -- Must have valid email domain from JWT claims
  (
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) LIKE '%@alteryx.com' 
    OR 
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) LIKE '%@whitestonebranding.com'
  )
);