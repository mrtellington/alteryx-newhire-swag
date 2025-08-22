-- Create a function to get all orders for admin users
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
  -- Get current user email from JWT claims
  current_user_email := LOWER(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text));
  
  -- Check if current user is an admin (hardcoded check)
  IF current_user_email NOT IN ('admin@whitestonebranding.com', 'dev@whitestonebranding.com', 'cecilia@whitestonebranding.com') THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
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
  FROM public.orders o;
END;
$$;