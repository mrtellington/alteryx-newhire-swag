-- Fix the create_user_from_webhook function to generate a proper UUID instead of using auth.uid()
CREATE OR REPLACE FUNCTION public.create_user_from_webhook(user_email text, user_full_name text, user_shipping_address jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();

  -- Create new user with generated UUID
  INSERT INTO users (id, email, full_name, invited, shipping_address)
  VALUES (new_user_id, user_email, user_full_name, true, user_shipping_address)
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$function$