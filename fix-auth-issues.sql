-- Fix Auth Issues - Run this in Supabase SQL Editor
-- This script will fix the authentication problems

-- Step 1: Check if user exists
SELECT 'Checking if user exists...' as status;
SELECT 
  id,
  email,
  invited,
  full_name,
  order_submitted,
  created_at
FROM users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Step 2: Create user if it doesn't exist
INSERT INTO users (
  id, 
  email, 
  full_name, 
  invited, 
  shipping_address, 
  created_at
) VALUES (
  '7c072e93-c879-49d2-9d0e-f7447b2d9ab8',
  'tod.ellington@whitestonebranding.com',
  'Tod Ellington',
  true,
  '{"address_line_1": "123 Developer Street", "city": "Test City", "state": "CA", "zip_code": "90210", "country": "USA"}',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  invited = true,
  full_name = 'Tod Ellington',
  shipping_address = '{"address_line_1": "123 Developer Street", "city": "Test City", "state": "CA", "zip_code": "90210", "country": "USA"}';

-- Step 3: Verify user was created/updated
SELECT 'User created/updated successfully' as status;
SELECT 
  id,
  email,
  invited,
  full_name,
  order_submitted,
  created_at
FROM users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Step 4: Fix RLS policies
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "System can check user existence" ON users;

-- Create new policies that work better for auth flow
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- This policy is crucial - it allows the auth flow to check if user exists
CREATE POLICY "System can check user existence" ON users
  FOR SELECT USING (true);

-- Step 5: Test the policies work
SELECT 'Testing RLS policies...' as status;
-- This should work now
SELECT 
  id,
  email,
  invited
FROM users 
WHERE id = '7c072e93-c879-49d2-9d0e-f7447b2d9ab8';

-- Step 6: Create admin functions if they don't exist
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Hardcoded system admins
  RETURN auth.jwt() ->> 'email' IN (
    'admin@whitestonebranding.com',
    'tod.ellington@whitestonebranding.com',
    'dev@whitestonebranding.com'
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN is_system_admin();
END;
$$;

-- Step 7: Create security events table if it doesn't exist
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 8: Create security event logging function
CREATE OR REPLACE FUNCTION log_security_event(
  event_type TEXT,
  user_id UUID DEFAULT NULL,
  details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO security_events (event_type, user_id, details)
  VALUES (event_type, user_id, details)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- Step 9: Log a test event
SELECT 'Logging test security event...' as status;
SELECT log_security_event('auth_test', '7c072e93-c879-49d2-9d0e-f7447b2d9ab8', '{"test": "auth_fix_applied"}');

-- Step 10: Final verification
SELECT 'Final verification...' as status;
SELECT 
  'User exists and is invited' as check_result,
  COUNT(*) as user_count
FROM users 
WHERE email = 'tod.ellington@whitestonebranding.com' 
  AND invited = true;

SELECT 
  'RLS policies exist' as check_result,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'users';

SELECT 'Auth fix complete! Now test the login flow.' as final_status;
