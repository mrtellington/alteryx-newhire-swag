-- Update inventory RLS policy to be more restrictive
-- Remove the current overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read inventory" ON public.inventory;

-- Create a more restrictive policy - only allow reading for users who haven't ordered yet
-- This prevents unnecessary data exposure while maintaining functionality
CREATE POLICY "Users can view inventory only when ordering" 
ON public.inventory 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND order_submitted = false
  )
);

-- Add security enhancement: Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  user_id uuid DEFAULT auth.uid(),
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- In a real application, you might want a dedicated security_logs table
  -- For now, we'll just ensure this function exists for future use
  -- This could log to a security_events table or external monitoring service
  
  -- Example: INSERT INTO security_events (event_type, user_id, metadata, created_at)
  -- VALUES (event_type, user_id, metadata, now());
  
  -- For now, just return without error
  RETURN;
END;
$$;