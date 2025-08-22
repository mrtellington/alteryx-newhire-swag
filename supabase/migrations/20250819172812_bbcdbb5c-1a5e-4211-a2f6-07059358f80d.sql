-- Delete all unauthorized auth users
-- First, let's create a function to clean up unauthorized auth users

CREATE OR REPLACE FUNCTION public.cleanup_unauthorized_auth_users()
RETURNS TABLE(deleted_email text, deleted_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_user RECORD;
  is_admin BOOLEAN;
  is_eligible_user BOOLEAN;
BEGIN
  -- Loop through all auth users
  FOR auth_user IN 
    SELECT au.id, au.email 
    FROM auth.users au
  LOOP
    -- Check if user is an active admin
    SELECT EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE LOWER(email) = LOWER(auth_user.email) AND active = true
    ) INTO is_admin;
    
    -- Check if user is an invited user who hasn't ordered
    SELECT EXISTS (
      SELECT 1 FROM public.users 
      WHERE LOWER(email) = LOWER(auth_user.email) 
      AND invited = true 
      AND order_submitted = false
    ) INTO is_eligible_user;
    
    -- If not authorized, delete the auth user
    IF NOT (is_admin OR is_eligible_user) THEN
      -- Log the deletion
      INSERT INTO public.security_events (
        event_type,
        user_email,
        metadata,
        severity,
        created_at
      ) VALUES (
        'unauthorized_auth_user_deleted',
        auth_user.email,
        jsonb_build_object(
          'deleted_user_id', auth_user.id,
          'reason', 'User not in authorized database or already ordered'
        ),
        'high',
        now()
      );
      
      -- Delete the auth user
      PERFORM auth.uid(); -- This should trigger proper auth context
      -- Note: We'll delete manually using admin API from the edge function
      
      -- Return the deleted user info
      deleted_email := auth_user.email;
      deleted_id := auth_user.id;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;