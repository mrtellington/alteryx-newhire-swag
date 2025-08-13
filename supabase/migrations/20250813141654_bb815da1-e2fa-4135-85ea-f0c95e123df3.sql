-- Remove the unique constraint on user_id in orders table
-- This allows users to have multiple orders if they are reset by admin
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_key;