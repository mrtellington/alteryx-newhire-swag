-- Update get_all_orders_for_admin to allow both full and view-only admins to read orders
CREATE OR REPLACE FUNCTION public.get_all_orders_for_admin()
 RETURNS TABLE(id uuid, user_id uuid, order_number text, date_submitted timestamp with time zone, status text, tee_size text, tracking_number text, shipping_carrier text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_email TEXT;
  user_role TEXT;
BEGIN
  -- Get current user email from JWT claims for logging
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Get user's admin role
  user_role := public.get_admin_role();
  
  -- Allow both full admins and view-only admins to read orders
  IF user_role NOT IN ('admin', 'view_only') THEN
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
        'reason', 'not_admin_or_view_only_user',
        'user_role', user_role
      ),
      'medium',
      now()
    );
    
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Log successful admin access (both types)
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
      'function', 'get_all_orders_for_admin',
      'user_role', user_role
    ),
    'low',
    now()
  );
  
  -- Return all orders if user is admin or view-only admin
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
$function$