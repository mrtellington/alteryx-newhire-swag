-- Update Supabase auth configuration for enhanced security
-- This is done via SQL for consistency

-- Update OTP expiry time to 10 minutes (more secure than default)
UPDATE auth.config 
SET 
  otp_exp = 600, -- 10 minutes instead of default 60 minutes
  otp_length = 6,
  password_min_length = 8
WHERE true;

-- Add IP-based rate limiting configuration (if supported)
-- Note: This would typically be configured in the Supabase dashboard
-- but we can set up monitoring for multiple failed attempts

-- Create a function to monitor repeated login failures from same IP
CREATE OR REPLACE FUNCTION public.monitor_login_failures()
RETURNS TRIGGER AS $$
DECLARE
  failure_count INTEGER;
  client_ip TEXT;
BEGIN
  -- Extract IP from metadata if available
  client_ip := NEW.metadata->>'ip_address';
  
  -- Count recent failures from same IP in last hour
  IF client_ip IS NOT NULL AND NEW.event_type LIKE '%login%' AND NEW.severity IN ('high', 'critical') THEN
    SELECT COUNT(*) INTO failure_count
    FROM public.security_events
    WHERE 
      metadata->>'ip_address' = client_ip 
      AND event_type LIKE '%login%'
      AND severity IN ('high', 'critical')
      AND created_at > NOW() - INTERVAL '1 hour';
    
    -- If more than 5 failures from same IP, log it as critical
    IF failure_count >= 5 THEN
      INSERT INTO public.security_events (
        event_type,
        metadata,
        severity,
        created_at
      ) VALUES (
        'multiple_login_failures_same_ip',
        jsonb_build_object(
          'ip_address', client_ip,
          'failure_count', failure_count,
          'time_window', '1 hour'
        ),
        'critical',
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to monitor login failures
DROP TRIGGER IF EXISTS monitor_login_failures_trigger ON public.security_events;
CREATE TRIGGER monitor_login_failures_trigger
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.monitor_login_failures();