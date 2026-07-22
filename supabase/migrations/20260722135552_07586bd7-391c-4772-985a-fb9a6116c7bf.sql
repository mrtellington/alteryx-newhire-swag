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

  INSERT INTO public.orders (user_id, order_number, tee_size, status)
  VALUES (user_record.id, new_order_number, tee_size_param, 'pending')
  RETURNING id INTO new_order_id;

  UPDATE public.users
  SET order_submitted = true,
      order_date = now()
  WHERE id = user_record.id;

  RETURN new_order_id;
END;
$function$;