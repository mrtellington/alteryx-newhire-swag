-- Update get_all_orders_for_admin function to use proper admin authentication
CREATE OR REPLACE FUNCTION public.get_all_orders_for_admin()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  order_number TEXT,
  date_submitted TIMESTAMP WITH TIME ZONE,
  status TEXT,
  tee_size TEXT,
  tracking_number TEXT,
  shipping_carrier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get current user email from JWT claims for logging
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Use the proper admin check function instead of hardcoded emails
  IF NOT public.is_current_user_admin() THEN
    -- Log the failed attempt with more detail
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'admin_orders_access_denied',
      current_user_email,
      jsonb_build_object(
        'function', 'get_all_orders_for_admin',
        'reason', 'not_admin_user'
      ),
      'medium',
      now()
    );
    
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Log successful admin access
  INSERT INTO public.security_events (
    event_type,
    user_email,
    metadata,
    severity,
    created_at
  ) VALUES (
    'admin_orders_accessed',
    current_user_email,
    jsonb_build_object(
      'function', 'get_all_orders_for_admin'
    ),
    'low',
    now()
  );
  
  -- Return all orders if user is admin
  RETURN QUERY
  SELECT 
    o.id,
    o.user_id,
    o.order_number,
    o.date_submitted,
    o.status,
    o.tee_size,
    o.tracking_number,
    o.shipping_carrier
  FROM public.orders o
  ORDER BY o.date_submitted DESC;
END;
$$;