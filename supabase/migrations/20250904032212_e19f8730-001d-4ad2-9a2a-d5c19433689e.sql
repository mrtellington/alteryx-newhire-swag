-- Let's check if the policy is working by testing the exact condition
-- This will show us if the policy logic would work with proper JWT claims

-- First, let's see what the current policies look like
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users' AND cmd = 'SELECT';

-- Test the policy condition directly (simulating dev@ JWT claims)
-- We'll create a temporary function to test this
CREATE OR REPLACE FUNCTION public.test_policy_for_dev()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE LOWER(email) = 'dev@whitestonebranding.com'
    AND active = true
    AND role IN ('admin', 'view_only')
  );
END;
$$;