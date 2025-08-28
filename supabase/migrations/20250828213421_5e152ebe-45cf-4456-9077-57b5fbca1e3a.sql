-- Insert a test user to trigger the Slack notification
-- This will automatically trigger the slack_notify_user_added trigger
INSERT INTO public.users (
  email, 
  full_name, 
  first_name, 
  last_name, 
  invited, 
  created_at
) VALUES (
  'slack.test@alteryx.com',
  'Slack Test User', 
  'Slack',
  'Test',
  true,
  now()
);

-- Let's also check if the notification was logged
SELECT 
  event_type, 
  metadata, 
  created_at 
FROM public.security_events 
WHERE event_type IN ('slack_notification_triggered', 'slack_notification_failed')
ORDER BY created_at DESC 
LIMIT 3;