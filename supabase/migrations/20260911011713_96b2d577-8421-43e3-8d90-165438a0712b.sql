DROP FUNCTION IF EXISTS public.place_order(uuid, text);

CREATE FUNCTION public.place_order(user_uuid uuid, tee_size_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record users%ROWTYPE;
  new_order_id uuid;
  new_order_number text;
  addr jsonb;
  ship_name text;
  ship_country text;
  carrier text;
BEGIN
  SELECT * INTO user_record
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF user_record.order_submitted THEN
    RAISE EXCEPTION 'User has already placed an order';
  END IF;

  IF tee_size_param IS NULL OR btrim(tee_size_param) = '' THEN
    RAISE EXCEPTION 'Tee size is required';
  END IF;

  IF tee_size_param NOT IN ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL') THEN
    RAISE EXCEPTION 'Invalid tee size';
  END IF;

  new_order_number := public.generate_order_number();
  addr := COALESCE(user_record.shipping_address, '{}'::jsonb);

  ship_name := btrim(
    COALESCE(NULLIF(btrim(COALESCE(addr->>'first_name','') || ' ' || COALESCE(addr->>'last_name','')), ''),
             user_record.full_name, '')
  );

  ship_country := COALESCE(NULLIF(btrim(addr->>'country'), ''), '');

  carrier := CASE
    WHEN upper(ship_country) = 'US' OR lower(ship_country) = 'united states' THEN 'FedEx Ground'
    ELSE 'FedEx Connect Plus'
  END;

  INSERT INTO public.orders (
    user_id, order_number, tee_size, status,
    shipping_name, shipping_line1, shipping_line2, shipping_city,
    shipping_region, shipping_postal_code, shipping_country, shipping_phone,
    shipping_carrier
  )
  VALUES (
    user_record.id, new_order_number, tee_size_param, 'pending',
    NULLIF(ship_name,''), addr->>'line1', addr->>'line2', addr->>'city',
    addr->>'region', addr->>'postal_code', addr->>'country', addr->>'phone',
    carrier
  )
  RETURNING id INTO new_order_id;

  UPDATE public.users
  SET order_submitted = true
  WHERE id = user_record.id;

  RETURN new_order_id;
END;
$$;