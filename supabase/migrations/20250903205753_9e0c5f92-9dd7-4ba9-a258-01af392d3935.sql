-- Create a function to manually update admin password
CREATE OR REPLACE FUNCTION public.force_update_admin_password()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_record admin_users%ROWTYPE;
BEGIN
  -- Get the admin user
  SELECT * INTO admin_record 
  FROM public.admin_users 
  WHERE email = 'admin@whitestonebranding.com' AND active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- Log the password update attempt
  INSERT INTO public.security_events (
    event_type,
    user_email,
    metadata,
    severity,
    created_at
  ) VALUES (
    'manual_password_update_attempt',
    'admin@whitestonebranding.com',
    jsonb_build_object(
      'admin_id', admin_record.id,
      'auth_user_id', admin_record.auth_user_id
    ),
    'medium',
    now()
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'auth_user_id', admin_record.auth_user_id,
    'message', 'Ready for password update'
  );
END;
$function$;