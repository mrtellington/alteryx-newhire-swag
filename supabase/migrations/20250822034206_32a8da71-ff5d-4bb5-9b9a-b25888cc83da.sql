-- Add missing columns to admin_users table
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Add missing columns to security_events table  
ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS severity security_event_severity DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS ip_address text;

-- Add missing order_number column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number text;