-- First, let's drop the existing problematic policies and create secure ones

-- Drop existing policies on users table
DROP POLICY IF EXISTS "Users can insert their own profile if authenticated and invited" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;

-- Create secure, simple policies for users table

-- Policy 1: Users can only view their own profile (simplified and secure)
CREATE POLICY "Users can view own profile only" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR (auth_user_id IS NULL AND auth.uid() = id)
  )
  AND invited = true
);

-- Policy 2: Users can insert their own profile (simplified)
CREATE POLICY "Users can insert own profile" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR (auth_user_id IS NULL AND auth.uid() = id)
  )
  AND invited = true
);

-- Policy 3: Users can update their own profile (simplified)
CREATE POLICY "Users can update own profile" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR (auth_user_id IS NULL AND auth.uid() = id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    (auth_user_id IS NOT NULL AND auth.uid() = auth_user_id) 
    OR (auth_user_id IS NULL AND auth.uid() = id)
  )
);

-- Policy 4: Admins can view all users (using security definer function)
CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
TO authenticated
USING (is_user_admin());

-- Policy 5: Admins can update any user (using security definer function)
CREATE POLICY "Admins can update any user" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (is_user_admin())
WITH CHECK (is_user_admin());

-- Ensure RLS is enabled (should already be, but let's be explicit)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;