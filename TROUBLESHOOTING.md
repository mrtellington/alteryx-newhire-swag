# Auth Flow Troubleshooting Guide

## Issue: User gets logged out immediately after login

### Step 1: Check Database Setup

Run this SQL in Supabase to verify the user exists:

```sql
-- Check if user exists
SELECT 
  id,
  email,
  invited,
  full_name,
  order_submitted,
  created_at
FROM users 
WHERE email = 'tod.ellington@whitestonebranding.com';

-- Check if user exists by ID
SELECT 
  id,
  email,
  invited,
  full_name,
  order_submitted,
  created_at
FROM users 
WHERE id = '7c072e93-c879-49d2-9d0e-f7447b2d9ab8';
```

### Step 2: Check RLS Policies

Run this SQL to verify RLS policies are correct:

```sql
-- Check RLS policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users';
```

### Step 3: Test User Access

Run this SQL to test if the user can access their own record:

```sql
-- This should return the user record if RLS is working
SELECT 
  id,
  email,
  invited
FROM users 
WHERE id = '7c072e93-c879-49d2-9d0e-f7447b2d9ab8';
```

### Step 4: Check Browser Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for these log messages:
   ```
   🔐 AuthContext: Auth state changed: SIGNED_IN User logged in
   🔐 AuthContext: Fetching user profile for: [user-id]
   🔐 AuthContext: User profile loaded: [profile-data]
   🛡️ ProtectedRoute: Checking user access for user: [user-id]
   🛡️ ProtectedRoute: Access check result: true
   ```

### Step 5: Check Debug Component

The debug component on the product page will show:
- Current user state
- Session information
- User profile data
- Any errors from database queries

### Step 6: Common Issues and Fixes

#### Issue 1: User doesn't exist in database
**Fix:** Run this SQL to create the user:
```sql
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
  invited = true;
```

#### Issue 2: RLS policies blocking access
**Fix:** Run the updated database-setup.sql to fix RLS policies

#### Issue 3: Environment variables not loading
**Fix:** Check that .env file exists and has correct values:
```env
VITE_SUPABASE_URL=https://emnemfewmpjczkgwzrjv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA
```

#### Issue 4: Session not persisting
**Fix:** Clear browser cache and cookies, then try again

### Step 7: Manual Testing

1. **Clear all browser data** for localhost:3000
2. **Restart the development server:**
   ```bash
   npm start
   ```
3. **Go to** http://localhost:3000
4. **Enter email:** tod.ellington@whitestonebranding.com
5. **Click magic link** in email
6. **Check debug component** for detailed information

### Step 8: Expected Behavior

After successful login, you should see:
1. User redirected to product page
2. Debug component shows user data
3. No "Verifying access..." stuck state
4. Session persists through page refresh

### Step 9: If Still Not Working

1. **Check Supabase dashboard** for any errors
2. **Verify the user exists** in the users table
3. **Check RLS policies** are correctly applied
4. **Look at browser console** for specific error messages
5. **Try a different browser** to rule out cache issues

### Step 10: Emergency Fix

If nothing else works, temporarily disable RLS for testing:

```sql
-- TEMPORARY: Disable RLS for debugging (REMOVE AFTER FIXING)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

**Remember to re-enable RLS after fixing the issue:**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```
