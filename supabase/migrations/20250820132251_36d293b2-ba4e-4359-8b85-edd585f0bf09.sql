-- Remove tod.ellington@whitestonebranding.com and christian.houston@whitestonebranding.com from database and admin

-- First, delete any existing orders for these users
DELETE FROM public.orders 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tod.ellington@whitestonebranding.com', 'christian.houston@whitestonebranding.com')
);

-- Remove from admin_users table
DELETE FROM public.admin_users 
WHERE email IN ('tod.ellington@whitestonebranding.com', 'christian.houston@whitestonebranding.com');

-- Remove from users table
DELETE FROM public.users 
WHERE email IN ('tod.ellington@whitestonebranding.com', 'christian.houston@whitestonebranding.com');