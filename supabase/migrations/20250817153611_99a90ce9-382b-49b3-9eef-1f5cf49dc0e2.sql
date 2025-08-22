-- Fix the remaining search_path security warning for update_order_status function
CREATE OR REPLACE FUNCTION public.update_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If tracking number is being added and wasn't there before, set status to shipped
  IF NEW.tracking_number IS NOT NULL AND NEW.tracking_number != '' 
     AND (OLD.tracking_number IS NULL OR OLD.tracking_number = '') THEN
    NEW.status = 'shipped';
  END IF;
  
  -- If tracking number is being removed, set status back to pending
  IF (NEW.tracking_number IS NULL OR NEW.tracking_number = '') 
     AND OLD.tracking_number IS NOT NULL AND OLD.tracking_number != '' THEN
    NEW.status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$function$;