ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_name text,
  ADD COLUMN IF NOT EXISTS shipping_line1 text,
  ADD COLUMN IF NOT EXISTS shipping_line2 text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_region text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_country text,
  ADD COLUMN IF NOT EXISTS shipping_phone text;

CREATE OR REPLACE FUNCTION public.place_order(tee_size_param text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_record users%ROWTYPE;
  new_order_id uuid;
  new_order_number text;
  addr jsonb;
  ship_name text;
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

  INSERT INTO public.orders (
    user_id, order_number, tee_size, status,
    shipping_name, shipping_line1, shipping_line2, shipping_city,
    shipping_region, shipping_postal_code, shipping_country, shipping_phone
  )
  VALUES (
    user_record.id, new_order_number, tee_size_param, 'pending',
    NULLIF(ship_name,''), addr->>'line1', addr->>'line2', addr->>'city',
    addr->>'region', addr->>'postal_code', addr->>'country', addr->>'phone'
  )
  RETURNING id INTO new_order_id;

  UPDATE public.users
  SET order_submitted = true
  WHERE id = user_record.id;

  RETURN new_order_id;
END;
$function$;

UPDATE public.orders o
SET shipping_name = COALESCE(o.shipping_name, NULLIF(btrim(COALESCE(u.shipping_address->>'first_name','') || ' ' || COALESCE(u.shipping_address->>'last_name','')), ''), u.full_name),
    shipping_line1 = COALESCE(o.shipping_line1, u.shipping_address->>'line1'),
    shipping_line2 = COALESCE(o.shipping_line2, u.shipping_address->>'line2'),
    shipping_city = COALESCE(o.shipping_city, u.shipping_address->>'city'),
    shipping_region = COALESCE(o.shipping_region, u.shipping_address->>'region'),
    shipping_postal_code = COALESCE(o.shipping_postal_code, u.shipping_address->>'postal_code'),
    shipping_country = COALESCE(o.shipping_country, u.shipping_address->>'country'),
    shipping_phone = COALESCE(o.shipping_phone, u.shipping_address->>'phone')
FROM public.users u
WHERE u.id = o.user_id;