
-- Fix the place_order function to include proper WHERE clause in UPDATE
CREATE OR REPLACE FUNCTION public.place_order()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record users%ROWTYPE;
  inventory_record inventory%ROWTYPE;
  new_order_id UUID;
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

  -- Create order
  INSERT INTO orders (user_id)
  VALUES (auth.uid())
  RETURNING id INTO new_order_id;

  -- Update user order status
  UPDATE users SET order_submitted = true WHERE id = auth.uid();

  -- Update inventory with proper WHERE clause
  UPDATE inventory 
  SET quantity_available = quantity_available - 1 
  WHERE product_id = inventory_record.product_id;

  RETURN new_order_id;
END;
$$;
