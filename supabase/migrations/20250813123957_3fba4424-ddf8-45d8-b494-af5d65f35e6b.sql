-- Fix security function: Add explicit search_path for better security
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  user_id uuid DEFAULT auth.uid(),
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Enhanced security logging function with explicit search_path
  -- This prevents potential security issues from search_path manipulation
  
  -- In production, you would log to a dedicated security_events table
  -- Example implementation:
  -- INSERT INTO public.security_events (event_type, user_id, metadata, created_at)
  -- VALUES (event_type, user_id, metadata, now());
  
  -- For now, this function exists as a placeholder for future security logging
  RETURN;
END;
$$;