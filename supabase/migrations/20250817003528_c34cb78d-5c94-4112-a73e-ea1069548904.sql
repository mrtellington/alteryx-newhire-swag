-- Enhanced security improvements for the database

-- Create enhanced security event types
CREATE TYPE public.security_event_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Add severity column to security_events table
ALTER TABLE public.security_events 
ADD COLUMN IF NOT EXISTS severity public.security_event_severity DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS additional_context jsonb DEFAULT '{}';

-- Create an index for faster security event queries
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity 
ON public.security_events(event_type, severity, created_at DESC);

-- Create function to prevent admin self-privilege escalation
CREATE OR REPLACE FUNCTION public.prevent_admin_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get current user's email
  current_user_email := ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text);
  
  -- Prevent users from making themselves admin
  IF NEW.email = current_user_email AND OLD.active = false AND NEW.active = true THEN
    -- Log the attempt
    INSERT INTO public.security_events (
      event_type, 
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'admin_self_escalation_attempt',
      current_user_email,
      jsonb_build_object(
        'attempted_email', NEW.email,
        'action', 'self_activation'
      ),
      'critical',
      now()
    );
    
    RAISE EXCEPTION 'Users cannot activate their own admin privileges';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to prevent admin self-escalation
DROP TRIGGER IF EXISTS prevent_admin_self_escalation_trigger ON public.admin_users;
CREATE TRIGGER prevent_admin_self_escalation_trigger
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_self_escalation();

-- Create function for enhanced input validation
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_input(
  input_text TEXT,
  max_length INTEGER DEFAULT 255,
  allow_html BOOLEAN DEFAULT false
)
RETURNS TEXT AS $$
DECLARE
  cleaned_text TEXT;
BEGIN
  -- Return NULL for NULL input
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Trim whitespace
  cleaned_text := TRIM(input_text);
  
  -- Check length
  IF LENGTH(cleaned_text) > max_length THEN
    RAISE EXCEPTION 'Input exceeds maximum length of % characters', max_length;
  END IF;
  
  -- Remove dangerous patterns if HTML not allowed
  IF NOT allow_html THEN
    -- Remove script tags and javascript
    cleaned_text := regexp_replace(cleaned_text, '<script[^>]*>.*?</script>', '', 'gi');
    cleaned_text := regexp_replace(cleaned_text, 'javascript:', '', 'gi');
    cleaned_text := regexp_replace(cleaned_text, 'data:', '', 'gi');
    cleaned_text := regexp_replace(cleaned_text, 'vbscript:', '', 'gi');
    cleaned_text := regexp_replace(cleaned_text, 'on\w+\s*=', '', 'gi');
  END IF;
  
  RETURN cleaned_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to log detailed security events
CREATE OR REPLACE FUNCTION public.log_detailed_security_event(
  event_type text,
  user_id uuid DEFAULT auth.uid(),
  severity public.security_event_severity DEFAULT 'medium',
  metadata jsonb DEFAULT '{}',
  session_id text DEFAULT NULL,
  additional_context jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_email TEXT;
  client_ip TEXT;
  user_agent TEXT;
BEGIN
  -- Get user email from JWT claims
  current_user_email := ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text);
  
  -- Try to get client IP and user agent from request headers if available
  BEGIN
    client_ip := current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    client_ip := 'unknown';
  END;
  
  BEGIN
    user_agent := current_setting('request.headers', true)::jsonb ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    user_agent := 'unknown';
  END;

  -- Insert the enhanced security event
  INSERT INTO public.security_events (
    event_type, 
    user_id, 
    user_email,
    ip_address,
    user_agent,
    metadata,
    severity,
    session_id,
    additional_context,
    created_at
  ) VALUES (
    event_type, 
    user_id,
    current_user_email,
    client_ip,
    user_agent,
    metadata,
    severity,
    session_id,
    additional_context,
    now()
  );
  
  -- Log critical security events to PostgreSQL logs
  IF severity IN ('high', 'critical') THEN
    RAISE NOTICE 'SECURITY ALERT [%]: % by user % (%) at %', 
      severity,
      event_type, 
      current_user_email, 
      user_id, 
      now();
  END IF;
END;
$$;

-- Create function to check for suspicious activity patterns
CREATE OR REPLACE FUNCTION public.check_suspicious_activity(
  user_email_param TEXT,
  event_type_param TEXT,
  time_window_minutes INTEGER DEFAULT 15,
  max_events INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  event_count INTEGER;
BEGIN
  -- Count events of this type for this user in the time window
  SELECT COUNT(*) INTO event_count
  FROM public.security_events
  WHERE user_email = user_email_param
    AND event_type = event_type_param
    AND created_at > (now() - INTERVAL '1 minute' * time_window_minutes);
  
  -- Return true if suspicious activity detected
  RETURN event_count >= max_events;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for security monitoring dashboard
CREATE OR REPLACE VIEW public.security_dashboard AS
SELECT 
  event_type,
  severity,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_email) as unique_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM public.security_events
WHERE created_at > (now() - INTERVAL '24 hours')
GROUP BY event_type, severity
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
  END,
  event_count DESC;

-- Grant access to security dashboard for admins
CREATE POLICY "Admins can view security dashboard"
ON public.security_events
FOR SELECT
TO authenticated
USING (is_user_admin());

-- Add unique constraint to prevent duplicate admin entries
ALTER TABLE public.admin_users 
ADD CONSTRAINT unique_admin_email UNIQUE (email);

-- Create function to validate email domains with logging
CREATE OR REPLACE FUNCTION public.validate_email_domain(email_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN;
  domain_part TEXT;
BEGIN
  -- Extract domain
  domain_part := LOWER(SPLIT_PART(email_param, '@', 2));
  
  -- Check if valid
  is_valid := email_param = 'tod.ellington@gmail.com' OR 
              domain_part IN ('alteryx.com', 'whitestonebranding.com');
  
  -- Log invalid domain attempts
  IF NOT is_valid THEN
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'invalid_email_domain_attempt',
      email_param,
      jsonb_build_object('domain', domain_part),
      'medium',
      now()
    );
  END IF;
  
  RETURN is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;