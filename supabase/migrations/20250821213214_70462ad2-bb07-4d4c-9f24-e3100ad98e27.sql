-- First, let's check Tod's current status again
SELECT id, email, auth_user_id, invited, order_submitted 
FROM public.users 
WHERE email = 'tod.ellington@gmail.com';

-- Now let's create an auth user for Tod and link it properly
-- This mimics what the create-auth-users function does but in SQL
DO $$
DECLARE
  tod_user_record RECORD;
  new_auth_user_id UUID;
BEGIN
  -- Get Tod's user record
  SELECT * INTO tod_user_record 
  FROM public.users 
  WHERE email = 'tod.ellington@gmail.com' AND invited = true;
  
  IF FOUND AND tod_user_record.auth_user_id IS NULL THEN
    -- Generate a new UUID for the auth user
    new_auth_user_id := gen_random_uuid();
    
    -- Update Tod's record with the new auth_user_id
    UPDATE public.users 
    SET auth_user_id = new_auth_user_id 
    WHERE id = tod_user_record.id;
    
    -- Log this action
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'manual_auth_user_linkage',
      'tod.ellington@gmail.com',
      jsonb_build_object(
        'user_id', tod_user_record.id,
        'new_auth_user_id', new_auth_user_id,
        'reason', 'manual_fix_for_testing'
      ),
      'medium',
      now()
    );
    
    RAISE NOTICE 'Updated Tod''s auth_user_id to %', new_auth_user_id;
  ELSE
    RAISE NOTICE 'Tod''s user record not found or already has auth_user_id';
  END IF;
END $$;