-- Reset tod.ellington@whitestonebranding.com for testing
-- Delete any orders for this user
DELETE FROM public.orders WHERE user_id = '5a0f60a3-a760-4471-8b75-7ab6c31d5d40';

-- Set order_submitted to false
UPDATE public.users 
SET order_submitted = false 
WHERE email = 'tod.ellington@whitestonebranding.com';