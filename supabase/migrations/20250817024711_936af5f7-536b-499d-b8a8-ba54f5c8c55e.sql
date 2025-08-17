-- Add shipped status to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create trigger to automatically set status to 'shipped' when tracking number is added
CREATE OR REPLACE FUNCTION update_order_status()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_order_status ON public.orders;
CREATE TRIGGER trigger_update_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status();