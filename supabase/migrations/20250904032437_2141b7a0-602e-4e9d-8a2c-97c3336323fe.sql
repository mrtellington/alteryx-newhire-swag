-- Remove the old separate user profile policy since we combined it
DROP POLICY "Users can view own profile" ON public.users;

-- Verify we now have just one clean SELECT policy
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users' AND cmd = 'SELECT';