-- Create a function to bypass RLS and delete all users
CREATE OR REPLACE FUNCTION public.nuclear_reset_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_user_count INTEGER;
  deleted_order_count INTEGER;
BEGIN
  -- Delete all orders first (due to foreign key constraints)
  DELETE FROM public.orders;
  GET DIAGNOSTICS deleted_order_count = ROW_COUNT;
  
  -- Delete all users
  DELETE FROM public.users;
  GET DIAGNOSTICS deleted_user_count = ROW_COUNT;
  
  -- Log the nuclear reset
  INSERT INTO public.security_events (
    event_type,
    metadata,
    severity,
    created_at
  ) VALUES (
    'nuclear_reset_executed',
    jsonb_build_object(
      'deleted_users', deleted_user_count,
      'deleted_orders', deleted_order_count,
      'timestamp', now()
    ),
    'critical',
    now()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_users', deleted_user_count,
    'deleted_orders', deleted_order_count,
    'message', 'Nuclear reset completed successfully'
  );
END;
$$;