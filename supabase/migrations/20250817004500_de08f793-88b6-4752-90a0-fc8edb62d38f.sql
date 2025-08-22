-- Critical Security Fix: Restrict user data access to own profile only

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Users can view own profile only" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile if authenticated and invited" ON public.users;

-- Create secure, bulletproof policies

-- Policy 1: Users can ONLY view their own profile data
CREATE POLICY "Users can view own profile only" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  -- User must be authenticated
  auth.uid() IS NOT NULL 
  AND (
    -- Match by auth_user_id if it exists
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR 
    -- Otherwise match by user ID (for legacy compatibility)
    (auth_user_id IS NULL AND auth.uid() = id)
  )
  -- Additional security: only if user is invited (prevents access to non-invited records)
  AND invited = true
);

-- Policy 2: Users can insert their own profile only
CREATE POLICY "Users can insert own profile" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL 
  AND (
    -- New record must belong to the authenticated user
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR 
    (auth_user_id IS NULL AND auth.uid() = id)
  )
  -- Can only create invited profiles
  AND invited = true
);

-- Policy 3: Users can update their own profile only
CREATE POLICY "Users can update own profile" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (
  -- Must own the record to update it
  auth.uid() IS NOT NULL 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR 
    (auth_user_id IS NULL AND auth.uid() = id)
  )
)
WITH CHECK (
  -- After update, must still own the record
  auth.uid() IS NOT NULL 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR 
    (auth_user_id IS NULL AND auth.uid() = id)
  )
);

-- Policy 4: Admin-only access for viewing all users
CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  -- Only admins can view all user data
  is_user_admin()
);

-- Policy 5: Admin-only access for updating any user
CREATE POLICY "Admins can update any user" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (
  -- Only admins can update any user
  is_user_admin()
)
WITH CHECK (
  -- Only admins can update any user
  is_user_admin()
);

-- Policy 6: Prevent deletion of user profiles (security measure)
CREATE POLICY "No user deletion allowed" 
ON public.users 
FOR DELETE 
TO authenticated
USING (false);

-- Log this critical security fix
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'critical_security_fix_applied',
  'system',
  jsonb_build_object(
    'fix_type', 'users_table_rls_policies',
    'description', 'Fixed customer data exposure vulnerability',
    'tables_affected', ARRAY['users'],
    'fix_timestamp', now()
  ),
  'critical',
  now()
);