-- Enhanced security monitoring setup (without auth.config modifications)

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

-- Create function to detect session anomalies
CREATE OR REPLACE FUNCTION public.detect_session_anomalies()
RETURNS TRIGGER AS $$
DECLARE
  recent_sessions INTEGER;
  different_locations INTEGER;
BEGIN
  -- Check for multiple concurrent sessions from different locations
  IF NEW.event_type = 'auth_signed_in' THEN
    -- Count recent sessions from same user but different IPs
    SELECT COUNT(DISTINCT metadata->>'ip_address') INTO different_locations
    FROM public.security_events
    WHERE 
      user_email = NEW.user_email
      AND event_type = 'auth_signed_in'
      AND created_at > NOW() - INTERVAL '30 minutes'
      AND metadata->>'ip_address' IS NOT NULL
      AND metadata->>'ip_address' != NEW.metadata->>'ip_address';
    
    -- Alert if user signed in from multiple locations simultaneously
    IF different_locations >= 2 THEN
      INSERT INTO public.security_events (
        event_type,
        user_email,
        metadata,
        severity,
        created_at
      ) VALUES (
        'suspicious_concurrent_sessions',
        NEW.user_email,
        jsonb_build_object(
          'current_ip', NEW.metadata->>'ip_address',
          'concurrent_locations', different_locations,
          'user_email', NEW.user_email
        ),
        'high',
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for session anomaly detection
DROP TRIGGER IF EXISTS detect_session_anomalies_trigger ON public.security_events;
CREATE TRIGGER detect_session_anomalies_trigger
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_session_anomalies();