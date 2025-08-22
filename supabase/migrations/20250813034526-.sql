-- Fix linter: set stable search_path for existing functions

create or replace function public.create_user_from_webhook(user_email text, user_full_name text, user_shipping_address jsonb)
 returns uuid
 language plpgsql
 security definer set search_path = public
as $function$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = user_email) THEN
    RAISE EXCEPTION 'User with email % already exists', user_email;
  END IF;

  -- Validate email domain - allow @alteryx.com and @whitestonebranding.com
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com') THEN
    RAISE EXCEPTION 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed';
  END IF;

  -- Create new user
  INSERT INTO users (id, email, full_name, invited, shipping_address)
  VALUES (auth.uid(), user_email, user_full_name, true, user_shipping_address)
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$function$;

create or replace function public.place_order()
 returns uuid
 language plpgsql
 security definer set search_path = public
as $function$
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

  -- Get inventory
  SELECT * INTO inventory_record FROM inventory LIMIT 1;
  
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

  -- Update inventory
  UPDATE inventory SET quantity_available = quantity_available - 1;

  RETURN new_order_id;
END;
$function$;