-- Fix the tracking notification trigger by removing the net.http_post call
-- The net extension is not available in this Supabase instance
CREATE OR REPLACE FUNCTION public.send_tracking_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update status when tracking number is added (not updated from one value to another)
  IF NEW.tracking_number IS NOT NULL 
     AND NEW.tracking_number != '' 
     AND (OLD.tracking_number IS NULL OR OLD.tracking_number = '') THEN
    
    -- Just log that tracking was added - we'll handle email notifications separately
    RAISE NOTICE 'Tracking number added for order %: %', NEW.id, NEW.tracking_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public';