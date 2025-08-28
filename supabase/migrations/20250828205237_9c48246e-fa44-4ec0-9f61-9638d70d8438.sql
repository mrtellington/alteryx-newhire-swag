-- Fix search path security issues in functions that were flagged
-- These functions need to have their search_path set to 'public' for security

-- Update functions that don't have SET search_path = 'public'
CREATE OR REPLACE FUNCTION public.get_auth_users_to_clean()
 RETURNS TABLE(email text, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    admin_emails TEXT[];
BEGIN
    -- Get admin emails from admin_users table instead of hardcoded
    SELECT ARRAY(
        SELECT admin_users.email 
        FROM public.admin_users 
        WHERE active = true
    ) INTO admin_emails;
    
    -- Log that cleanup function was called
    INSERT INTO public.security_events (
        event_type,
        metadata,
        severity,
        created_at
    ) VALUES (
        'auth_cleanup_function_called',
        jsonb_build_object(
            'admin_emails_to_preserve', admin_emails
        ),
        'medium',
        now()
    );
    
    -- Return placeholder data - the actual cleanup will be done by the cleanup function
    RETURN QUERY SELECT 
        'cleanup_needed'::text as email,
        'use_cleanup_function'::text as reason;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_tracking_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update status when tracking number is added (not updated from one value to another)
  IF NEW.tracking_number IS NOT NULL 
     AND NEW.tracking_number != '' 
     AND (OLD.tracking_number IS NULL OR OLD.tracking_number = '') THEN
    
    -- Just log that tracking was added - we'll handle email notifications separately
    RAISE NOTICE 'Tracking number added for order %: %', NEW.id, NEW.tracking_number;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If tracking number is being added and wasn't there before, set status to shipped
  IF NEW.tracking_number IS NOT NULL AND NEW.tracking_number != '' 
     AND (OLD.tracking_number IS NULL OR OLD.tracking_number = '') THEN
    NEW.status = 'shipped';
  END IF;
  
  -- If tracking number is being removed, set status back to pending
  IF (NEW.tracking_number IS NULL OR NEW.tracking_number = '') 
     AND OLD.tracking_number IS NOT NULL AND OLD.tracking_number != '' THEN
    NEW.status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_auth_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for invited users without auth_user_id
  IF NEW.invited = true AND NEW.auth_user_id IS NULL THEN
    -- Log that we need to create an auth user automatically
    INSERT INTO public.security_events (
      event_type,
      user_email,
      metadata,
      severity,
      created_at
    ) VALUES (
      'auto_auth_creation_needed',
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'trigger_reason', 'new_user_without_auth'
      ),
      'low',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;