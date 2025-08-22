-- Reset all users to have no orders placed
UPDATE public.users SET order_submitted = false;

-- Delete all existing orders
DELETE FROM public.orders;