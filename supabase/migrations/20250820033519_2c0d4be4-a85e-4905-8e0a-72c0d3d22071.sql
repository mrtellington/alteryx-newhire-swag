-- Reset tod.ellington@whitestonebranding.com (third reset)
-- First, delete any existing orders for this user
DELETE FROM public.orders 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE email = 'tod.ellington@whitestonebranding.com'
);

-- Reset the order_submitted flag for this user
UPDATE public.users 
SET order_submitted = false 
WHERE email = 'tod.ellington@whitestonebranding.com';