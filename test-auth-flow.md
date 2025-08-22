# Auth Flow Test Script

## Pre-Test Setup

1. **Ensure database is set up:**
   ```sql
   -- Run the updated database-setup.sql in Supabase
   ```

2. **Add developer user:**
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

3. **Start development server:**
   ```bash
   npm start
   ```

## Test Cases

### Test 1: Basic Auth Flow
**Expected:** User can log in and access the portal

1. Go to `http://localhost:3000`
2. Should redirect to login page
3. Enter `tod.ellington@whitestonebranding.com`
4. Click "Send Magic Link"
5. Check email for magic link
6. Click magic link
7. Should land on product page (not stuck on "Verifying access...")

### Test 2: Session Persistence
**Expected:** Session persists through navigation and refresh

1. After successful login, refresh the page
2. Should stay logged in (no redirect to login)
3. Open new tab to `http://localhost:3000`
4. Should be logged in immediately
5. Navigate between pages
6. Should maintain session

### Test 3: Access Control
**Expected:** Non-invited users get access denied

1. Add a test user with `invited = false`:
   ```sql
   INSERT INTO users (email, full_name, invited, shipping_address) VALUES 
   ('test@alteryx.com', 'Test User', false, '{"address_line_1": "123 Test St", "city": "Test City", "state": "CA", "zip_code": "12345", "country": "USA"}');
   ```
2. Try to log in with `test@alteryx.com`
3. Should see "Access Denied" page

### Test 4: Domain Validation
**Expected:** Non-allowed domains are rejected

1. Try to log in with `test@gmail.com`
2. Should see error: "Only @alteryx.com email addresses are allowed"

### Test 5: Admin Access
**Expected:** Admin can access admin dashboard

1. Log in as `tod.ellington@whitestonebranding.com`
2. Navigate to `http://localhost:3000/admin`
3. Should see admin dashboard with users and orders

### Test 6: Order Flow
**Expected:** User can place one order successfully

1. Log in as invited user
2. Go to product page
3. Click "Place Order"
4. Should see confirmation page
5. Try to place another order
6. Should be prevented (frontend disabled + backend error)

## Console Logs to Monitor

Watch for these log messages during testing:

```
🔐 AuthContext: Initializing authentication...
🔐 AuthContext: Initial session check: User logged in
🔐 AuthContext: Fetching user profile for: [user-id]
🔐 AuthContext: User profile loaded: [profile-data]
🛡️ ProtectedRoute: Effect triggered
🛡️ ProtectedRoute: Checking user access...
🛡️ ProtectedRoute: Access check result: true
🛡️ ProtectedRoute: Showing protected content
```

## Expected Fixes Verified

- ✅ No more "Verifying access..." stuck state
- ✅ Session persists through refresh and navigation
- ✅ Proper error handling for missing users
- ✅ Admin dashboard accessible
- ✅ RLS policies working correctly
- ✅ Environment variables loading properly

## Troubleshooting

If tests fail:

1. **Check browser console** for errors
2. **Verify .env file** exists with correct variables
3. **Check Supabase dashboard** for user records
4. **Restart development server** if needed
5. **Clear browser cache** and cookies
