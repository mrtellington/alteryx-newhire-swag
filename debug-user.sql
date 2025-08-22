-- Debug script to check user status
-- Run this in Supabase SQL Editor

-- Check if the user exists
SELECT 
  id,
  email,
  invited,
  full_name,
  order_submitted,
  created_at
FROM users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Check if there are any users at all
SELECT COUNT(*) as total_users FROM users;

-- Check the specific user by ID (from the error message)
SELECT 
  id,
  email,
  invited,
  full_name,
  order_submitted,
  created_at
FROM users 
WHERE id = '7c072e93-c879-49d2-9d0e-f7447b2d9ab8';

-- Test RLS policies
-- This should work for the authenticated user
SELECT 
  id,
  email,
  invited
FROM users 
WHERE id = '7c072e93-c879-49d2-9d0e-f7447b2d9ab8';

-- Check security events
SELECT 
  event_type,
  user_id,
  details,
  created_at
FROM security_events 
ORDER BY created_at DESC 
LIMIT 10;
