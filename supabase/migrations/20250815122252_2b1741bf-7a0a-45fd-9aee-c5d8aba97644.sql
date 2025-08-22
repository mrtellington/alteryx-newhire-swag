-- Create a function to check user order status that bypasses RLS
CREATE OR REPLACE FUNCTION public.check_user_order_status(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_record RECORD;
  order_record RECORD;
  result jsonb;
BEGIN
  -- Find user by email
  SELECT id, order_submitted INTO user_record 
  FROM public.users 
  WHERE LOWER(email) = LOWER(user_email);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_ordered', false, 'user_exists', false);
  END IF;
  
  -- If user has not submitted an order, return early
  IF NOT user_record.order_submitted THEN
    RETURN jsonb_build_object('has_ordered', false, 'user_exists', true);
  END IF;
  
  -- Get order details
  SELECT order_number, date_submitted INTO order_record
  FROM public.orders 
  WHERE user_id = user_record.id
  ORDER BY date_submitted DESC
  LIMIT 1;
  
  IF FOUND THEN
    result := jsonb_build_object(
      'has_ordered', true,
      'user_exists', true,
      'order_number', order_record.order_number,
      'date_submitted', order_record.date_submitted
    );
  ELSE
    result := jsonb_build_object(
      'has_ordered', true,
      'user_exists', true,
      'order_number', null,
      'date_submitted', null
    );
  END IF;
  
  RETURN result;
END;
$$;