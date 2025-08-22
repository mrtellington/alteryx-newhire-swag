-- Add missing shipping_carrier column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_carrier text;