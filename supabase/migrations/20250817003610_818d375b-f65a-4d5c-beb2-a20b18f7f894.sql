-- Fix security linter issues

-- Fix function search paths for security functions
CREATE OR REPLACE FUNCTION public.prevent_admin_self_escalation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Fix validate_and_sanitize_input function
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_input(
  input_text TEXT,
  max_length INTEGER DEFAULT 255,
  allow_html BOOLEAN DEFAULT false
)
RETURNS TEXT 
LANGUAGE plpgsql 
IMMUTABLE
SET search_path TO 'public'
AS $$
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
$$;

-- Fix check_suspicious_activity function
CREATE OR REPLACE FUNCTION public.check_suspicious_activity(
  user_email_param TEXT,
  event_type_param TEXT,
  time_window_minutes INTEGER DEFAULT 15,
  max_events INTEGER DEFAULT 10
)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Fix validate_email_domain function
CREATE OR REPLACE FUNCTION public.validate_email_domain(email_param TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Drop the security definer view and replace with a function-based approach
DROP VIEW IF EXISTS public.security_dashboard;

-- Create a function instead of a security definer view
CREATE OR REPLACE FUNCTION public.get_security_dashboard()
RETURNS TABLE (
  event_type text,
  severity public.security_event_severity,
  event_count bigint,
  unique_users bigint,
  first_occurrence timestamp with time zone,
  last_occurrence timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow admin users to access this data
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    se.event_type,
    se.severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT se.user_email) as unique_users,
    MIN(se.created_at) as first_occurrence,
    MAX(se.created_at) as last_occurrence
  FROM public.security_events se
  WHERE se.created_at > (now() - INTERVAL '24 hours')
  GROUP BY se.event_type, se.severity
  ORDER BY 
    CASE se.severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
    END,
    COUNT(*) DESC;
END;
$$;