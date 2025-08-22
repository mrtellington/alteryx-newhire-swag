-- Update the place_order function to accept tee_size parameter
CREATE OR REPLACE FUNCTION public.place_order(tee_size_param text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_record users%ROWTYPE;
  inventory_record inventory%ROWTYPE;
  new_order_id UUID;
  new_order_number text;
BEGIN
  -- Get current user
  SELECT * INTO user_record FROM users WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user has already ordered
  IF user_record.order_submitted THEN
    RAISE EXCEPTION 'User has already placed an order';
  END IF;

  -- Get inventory (first available item)
  SELECT * INTO inventory_record FROM inventory WHERE quantity_available > 0 LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory available';
  END IF;

  -- Check if inventory is available
  IF inventory_record.quantity_available <= 0 THEN
    RAISE EXCEPTION 'Item is out of stock';
  END IF;

  -- Generate order number
  new_order_number := public.generate_order_number();

  -- Create order with order number and tee size
  INSERT INTO orders (user_id, order_number, tee_size)
  VALUES (auth.uid(), new_order_number, tee_size_param)
  RETURNING id INTO new_order_id;

  -- Update user order status
  UPDATE users SET order_submitted = true WHERE id = auth.uid();

  -- Update inventory with proper WHERE clause
  UPDATE inventory 
  SET quantity_available = quantity_available - 1 
  WHERE product_id = inventory_record.product_id;

  RETURN new_order_id;
END;
$function$