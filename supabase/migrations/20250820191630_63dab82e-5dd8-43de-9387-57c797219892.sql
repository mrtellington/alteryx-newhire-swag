-- Create a trigger to automatically create auth users for new database users
CREATE OR REPLACE FUNCTION auto_create_auth_user_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for invited users without auth_user_id
  IF NEW.invited = true AND NEW.auth_user_id IS NULL THEN
    -- Call the edge function to create auth user (async)
    PERFORM pg_notify('create_auth_user', json_build_object(
      'email', NEW.email,
      'full_name', NEW.full_name,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'user_id', NEW.id
    )::text);
    
    -- Log that we need to create an auth user
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'auth_user_auto_creation_triggered',
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'trigger_reason', 'new_invited_user_without_auth'
      ),
      'medium',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;