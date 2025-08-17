-- Create a function to send tracking notification when tracking number is added
CREATE OR REPLACE FUNCTION public.send_tracking_notification()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
BEGIN
  -- Only send notification if tracking number was added (not updated from one value to another)
  IF NEW.tracking_number IS NOT NULL 
     AND NEW.tracking_number != '' 
     AND (OLD.tracking_number IS NULL OR OLD.tracking_number = '') THEN
    
    -- Get the function URL
    function_url := 'https://emnemfewmpjczkgwzrjv.supabase.co/functions/v1/send-tracking-notification';
    
    -- Send async request to tracking notification function
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('orderId', NEW.id::text)
    );
    
    RAISE NOTICE 'Tracking notification triggered for order %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically send tracking notifications
DROP TRIGGER IF EXISTS send_tracking_notification_trigger ON public.orders;
CREATE TRIGGER send_tracking_notification_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.send_tracking_notification();