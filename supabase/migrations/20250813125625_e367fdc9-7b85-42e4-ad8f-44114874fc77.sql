-- Fix the search_path for the generate_order_number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number integer;
  new_order_number text;
BEGIN
  -- Get the highest existing order number and increment
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(orders.order_number FROM 6) AS integer)), 
    999
  ) + 1 INTO next_number
  FROM public.orders 
  WHERE orders.order_number LIKE 'AYXNH%';
  
  -- Generate the order number
  new_order_number := 'AYXNH' || next_number::text;
  
  RETURN new_order_number;
END;
$$;