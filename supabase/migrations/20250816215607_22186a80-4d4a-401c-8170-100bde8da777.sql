-- Add tracking_number field to orders table
ALTER TABLE public.orders 
ADD COLUMN tracking_number TEXT;