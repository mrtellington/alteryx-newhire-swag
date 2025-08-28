-- Create the Slack notification database function
CREATE OR REPLACE FUNCTION public.notify_slack_on_events(
  event_type_param text,
  event_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  function_url text;
BEGIN
  -- Get the Supabase URL for the edge function
  function_url := 'https://emnemfewmpjczkgwzrjv.supabase.co/functions/v1/send-slack-notification';
  
  -- Log the notification attempt
  INSERT INTO public.security_events (
    event_type,
    metadata,
    severity,
    created_at
  ) VALUES (
    'slack_notification_triggered',
    jsonb_build_object(
      'original_event_type', event_type_param,
      'notification_data', event_data,
      'timestamp', now()
    ),
    'low',
    now()
  );
  
  -- Make HTTP request to edge function (fire-and-forget)
  -- Using pg_net extension for async HTTP requests if available
  -- If pg_net is not available, this will fail gracefully without blocking the trigger
  BEGIN
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'eventType', event_type_param,
        'data', event_data
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't raise it (to avoid blocking the main operation)
    INSERT INTO public.security_events (
      event_type,
      metadata,
      severity,
      created_at
    ) VALUES (
      'slack_notification_failed',
      jsonb_build_object(
        'error', SQLERRM,
        'original_event_type', event_type_param,
        'notification_data', event_data
      ),
      'medium',
      now()
    );
  END;
END;
$$;

-- Create trigger function for user additions
CREATE OR REPLACE FUNCTION public.slack_notify_user_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only notify for invited users
  IF NEW.invited = true THEN
    PERFORM public.notify_slack_on_events(
      'user_added',
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'full_name', COALESCE(NEW.full_name, 'Unknown'),
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'created_at', NEW.created_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for order placements
CREATE OR REPLACE FUNCTION public.slack_notify_order_placed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_info RECORD;
BEGIN
  -- Get user information for the order
  SELECT email, full_name, first_name, last_name
  INTO user_info
  FROM public.users
  WHERE id = NEW.user_id;
  
  IF FOUND THEN
    PERFORM public.notify_slack_on_events(
      'order_placed',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tee_size', NEW.tee_size,
        'user_email', user_info.email,
        'user_name', COALESCE(user_info.full_name, user_info.first_name || ' ' || user_info.last_name, 'Unknown'),
        'date_submitted', NEW.date_submitted
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for login errors
CREATE OR REPLACE FUNCTION public.slack_notify_login_errors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only notify for auth/login related errors with high or critical severity
  IF NEW.event_type LIKE '%login%' OR NEW.event_type LIKE '%auth%' THEN
    IF NEW.severity IN ('high', 'critical') THEN
      PERFORM public.notify_slack_on_events(
        'login_error',
        jsonb_build_object(
          'event_type', NEW.event_type,
          'user_email', NEW.user_email,
          'severity', NEW.severity,
          'metadata', NEW.metadata,
          'ip_address', NEW.ip_address,
          'created_at', NEW.created_at
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for order shipping
CREATE OR REPLACE FUNCTION public.slack_notify_order_shipped()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_info RECORD;
BEGIN
  -- Check if tracking number was added (was NULL or empty, now has value)
  IF (OLD.tracking_number IS NULL OR OLD.tracking_number = '') 
     AND NEW.tracking_number IS NOT NULL 
     AND NEW.tracking_number != '' THEN
    
    -- Get user information for the order
    SELECT email, full_name, first_name, last_name
    INTO user_info
    FROM public.users
    WHERE id = NEW.user_id;
    
    IF FOUND THEN
      PERFORM public.notify_slack_on_events(
        'order_shipped',
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'shipping_carrier', NEW.shipping_carrier,
          'tee_size', NEW.tee_size,
          'user_email', user_info.email,
          'user_name', COALESCE(user_info.full_name, user_info.first_name || ' ' || user_info.last_name, 'Unknown')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the actual triggers
CREATE TRIGGER slack_notify_user_added
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.slack_notify_user_added();

CREATE TRIGGER slack_notify_order_placed
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.slack_notify_order_placed();

CREATE TRIGGER slack_notify_login_errors
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.slack_notify_login_errors();

CREATE TRIGGER slack_notify_order_shipped
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.slack_notify_order_shipped();