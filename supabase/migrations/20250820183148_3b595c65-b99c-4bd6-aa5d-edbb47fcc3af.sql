-- Create a function to handle auth user linking for the remaining users
CREATE OR REPLACE FUNCTION link_existing_auth_users()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_text TEXT := '';
BEGIN
  -- This function will be called by the create-auth-users edge function
  -- For now, just return the emails that need linking
  SELECT string_agg(email, ', ') INTO result_text
  FROM public.users 
  WHERE auth_user_id IS NULL AND invited = true;
  
  -- Log that these users need auth linking
  INSERT INTO public.security_events (
    event_type,
    metadata,
    severity,
    created_at
  ) VALUES (
    'auth_users_need_linking',
    jsonb_build_object(
      'users_needing_auth', result_text,
      'count', (SELECT COUNT(*) FROM public.users WHERE auth_user_id IS NULL AND invited = true)
    ),
    'medium',
    now()
  );
  
  RETURN 'Users needing auth linking: ' || COALESCE(result_text, 'none');
END;
$$;

-- Execute the function to log the current state
SELECT link_existing_auth_users();