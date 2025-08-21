-- Create a new auth_user_id for Tod and update his record
DO $$
DECLARE
  tod_user_record RECORD;
  new_auth_user_id UUID;
BEGIN
  -- Get Tod's user record (note: his email is now tod.ellington@whitestonebranding.com)
  SELECT * INTO tod_user_record 
  FROM public.users 
  WHERE email = 'tod.ellington@whitestonebranding.com' AND invited = true;
  
  IF FOUND AND tod_user_record.auth_user_id IS NULL THEN
    -- Generate a new UUID for the auth user (this will need to match a real Supabase auth user)
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
      'manual_auth_user_creation_needed',
      'tod.ellington@whitestonebranding.com',
      jsonb_build_object(
        'user_id', tod_user_record.id,
        'temp_auth_user_id', new_auth_user_id,
        'note', 'Need to create actual Supabase auth user with this ID'
      ),
      'medium',
      now()
    );
    
    RAISE NOTICE 'Updated Tod''s record with temp auth_user_id %. Real Supabase auth user needs to be created.', new_auth_user_id;
  ELSE
    RAISE NOTICE 'Tod''s user record not found or already has auth_user_id';
  END IF;
END $$;