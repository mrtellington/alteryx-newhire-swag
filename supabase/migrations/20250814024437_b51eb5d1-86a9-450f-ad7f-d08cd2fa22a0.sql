-- Fix security_events table policies to prevent tampering with audit logs

-- Add INSERT policy: Only allow inserts via the security definer function
-- This prevents direct user inserts while allowing the log_security_event function to work
CREATE POLICY "Security events can only be inserted via function" 
ON public.security_events 
FOR INSERT 
WITH CHECK (false); -- Deny all direct inserts - only allow via SECURITY DEFINER functions

-- Add UPDATE policy: Only admins can update security events (for corrections if needed)
CREATE POLICY "Only admins can update security_events" 
ON public.security_events 
FOR UPDATE 
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());

-- Add DELETE policy: Only admins can delete security events (for data retention if needed)
CREATE POLICY "Only admins can delete security_events" 
ON public.security_events 
FOR DELETE 
USING (public.is_user_admin());

-- Update the log_security_event function to bypass RLS for inserts
-- This allows the function to insert events while preventing direct user access
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type TEXT, 
  user_id UUID DEFAULT auth.uid(), 
  metadata JSONB DEFAULT '{}'::jsonb
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

  -- Insert the security event (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.security_events (
    event_type, 
    user_id, 
    user_email,
    ip_address,
    user_agent,
    metadata,
    created_at
  ) VALUES (
    event_type, 
    user_id,
    current_user_email,
    client_ip,
    user_agent,
    metadata,
    now()
  );
  
  -- Log critical security events to PostgreSQL logs as well for additional protection
  IF event_type IN ('unauthorized_admin_access', 'admin_user_added', 'admin_status_changed') THEN
    RAISE NOTICE 'SECURITY EVENT: % by user % (%) at %', 
      event_type, 
      current_user_email, 
      user_id, 
      now();
  END IF;
END;
$$;