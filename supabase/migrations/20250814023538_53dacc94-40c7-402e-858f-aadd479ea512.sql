-- Create admin users table for role-based access control
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy for admin_users - only admins can manage admins
CREATE POLICY "Only admins can view admin_users" 
ON public.admin_users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Only admins can insert admin_users" 
ON public.admin_users 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

CREATE POLICY "Only admins can update admin_users" 
ON public.admin_users 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- Insert initial admin users (these will be the only hardcoded admins)
INSERT INTO public.admin_users (user_id, email, created_by) 
VALUES 
  (gen_random_uuid(), 'admin@whitestonebranding.com', NULL),
  (gen_random_uuid(), 'dev@whitestonebranding.com', NULL);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_user_admin(user_email TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  check_email TEXT;
BEGIN
  -- Use provided email or get from JWT claims
  check_email := COALESCE(
    user_email, 
    lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))
  );
  
  -- Check if user is an active admin
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE lower(email) = lower(check_email) AND active = true
  );
END;
$$;

-- Fix any users with null auth_user_id by trying to link them to existing auth users
UPDATE public.users 
SET auth_user_id = (
  SELECT au.id 
  FROM auth.users au 
  WHERE lower(au.email) = lower(users.email)
  LIMIT 1
)
WHERE auth_user_id IS NULL 
AND EXISTS (
  SELECT 1 FROM auth.users au 
  WHERE lower(au.email) = lower(users.email)
);

-- Create security event logging table
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID,
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events
CREATE POLICY "Only admins can view security_events" 
ON public.security_events 
FOR SELECT 
USING (public.is_user_admin());

-- Update log_security_event function to actually log events
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
BEGIN
  INSERT INTO public.security_events (
    event_type, 
    user_id, 
    user_email,
    metadata
  ) VALUES (
    event_type, 
    user_id,
    ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text),
    metadata
  );
END;
$$;