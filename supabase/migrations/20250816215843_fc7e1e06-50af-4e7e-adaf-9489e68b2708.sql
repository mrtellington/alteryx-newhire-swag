-- Add shipping_carrier field to orders table
ALTER TABLE public.orders 
ADD COLUMN shipping_carrier TEXT;