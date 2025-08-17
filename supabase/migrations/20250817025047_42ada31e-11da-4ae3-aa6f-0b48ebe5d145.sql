-- Update existing orders that have tracking numbers but no shipped status
UPDATE public.orders 
SET status = 'shipped' 
WHERE tracking_number IS NOT NULL 
  AND tracking_number != '' 
  AND (status IS NULL OR status != 'shipped');