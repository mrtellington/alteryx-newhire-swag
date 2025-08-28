-- Update the notification function to work without pg_net extension
-- We'll use a simpler approach that just logs the notification attempt
-- The edge function will need to be called directly instead of from triggers

CREATE OR REPLACE FUNCTION public.notify_slack_on_events(
  event_type_param text,
  event_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the notification attempt with all the data needed for Slack
  INSERT INTO public.security_events (
    event_type,
    metadata,
    severity,
    created_at
  ) VALUES (
    'slack_notification_requested',
    jsonb_build_object(
      'original_event_type', event_type_param,
      'notification_data', event_data,
      'slack_webhook_needed', true,
      'timestamp', now()
    ),
    'low',
    now()
  );
  
  -- Since we can't use pg_net, we'll log this for manual/external processing
  -- The edge function can be called directly from the frontend when needed
  RAISE NOTICE 'Slack notification requested for event_type: %, data: %', event_type_param, event_data;
END;
$$;