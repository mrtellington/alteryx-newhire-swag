CREATE OR REPLACE FUNCTION public.normalize_match_text(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(lower(coalesce(t,'')), '\mstreet\M', 'st', 'g'),
      '\mavenue\M', 'ave', 'g'),
      '\mroad\M', 'rd', 'g'),
      '\mdrive\M', 'dr', 'g'),
      '\mboulevard\M', 'blvd', 'g'),
      '\msuite\M', 'ste', 'g'),
      '\mapartment\M', 'apt', 'g'),
    '[^a-z0-9]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.find_order_duplicates(p_name text, p_line1 text, p_city text, p_postal text, p_exclude_order uuid DEFAULT NULL)
RETURNS TABLE(order_id uuid, order_number text, shipping_name text, shipping_line1 text, shipping_city text, shipping_postal_code text, date_submitted timestamptz, name_matches boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.shipping_name, o.shipping_line1, o.shipping_city, o.shipping_postal_code, o.date_submitted,
         (normalize_match_text(o.shipping_name) = normalize_match_text(p_name) AND normalize_match_text(p_name) <> '') AS name_matches
  FROM orders o
  WHERE normalize_match_text(p_line1) <> ''
    AND normalize_match_text(o.shipping_line1) = normalize_match_text(p_line1)
    AND normalize_match_text(o.shipping_city) = normalize_match_text(p_city)
    AND normalize_match_text(o.shipping_postal_code) = normalize_match_text(p_postal)
    AND (p_exclude_order IS NULL OR o.id <> p_exclude_order)
    AND coalesce(o.status,'') <> 'cancelled'
  ORDER BY o.date_submitted DESC
$$;
REVOKE ALL ON FUNCTION public.find_order_duplicates(text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_order_duplicates(text,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.place_order(tee_size_param text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_record users%ROWTYPE;
  new_order_id uuid;
  new_order_number text;
  addr jsonb;
  ship_name text;
  ship_country text;
  carrier text;
BEGIN
  SELECT * INTO user_record FROM public.users WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF user_record.order_submitted THEN RAISE EXCEPTION 'User has already placed an order'; END IF;
  IF tee_size_param IS NULL OR btrim(tee_size_param) = '' THEN RAISE EXCEPTION 'Tee size is required'; END IF;
  IF tee_size_param NOT IN ('XS','S','M','L','XL','2XL','3XL','4XL') THEN RAISE EXCEPTION 'Invalid tee size'; END IF;

  addr := COALESCE(user_record.shipping_address, '{}'::jsonb);
  ship_name := btrim(COALESCE(NULLIF(btrim(COALESCE(addr->>'first_name','') || ' ' || COALESCE(addr->>'last_name','')), ''), user_record.full_name, ''));

  IF EXISTS (
    SELECT 1 FROM public.find_order_duplicates(ship_name, addr->>'line1', addr->>'city', addr->>'postal_code', NULL) d
    WHERE d.name_matches
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_ORDER: An order with this name and shipping address has already been placed.';
  END IF;

  new_order_number := public.generate_order_number();
  ship_country := COALESCE(NULLIF(btrim(addr->>'country'), ''), '');
  carrier := CASE WHEN upper(ship_country) = 'US' OR lower(ship_country) = 'united states' THEN 'FedEx Ground' ELSE 'FedEx Connect Plus' END;

  INSERT INTO public.orders (user_id, order_number, tee_size, status, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, shipping_postal_code, shipping_country, shipping_phone, shipping_carrier)
  VALUES (user_record.id, new_order_number, tee_size_param, 'pending', NULLIF(ship_name,''), addr->>'line1', addr->>'line2', addr->>'city', addr->>'region', addr->>'postal_code', addr->>'country', addr->>'phone', carrier)
  RETURNING id INTO new_order_id;

  UPDATE public.users SET order_submitted = true WHERE id = user_record.id;
  RETURN new_order_id;
END;
$function$;