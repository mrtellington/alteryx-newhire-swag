-- Clear all users and admin data for fresh import
DELETE FROM public.orders;
DELETE FROM public.users;
DELETE FROM public.admin_users;

-- Also clear security events related to user creation to start fresh
DELETE FROM public.security_events WHERE event_type IN (
  'user_created_via_webhook',
  'user_updated_via_webhook',
  'webhook_user_creation_error',
  'auth_users_need_linking',
  'auto_auth_creation_needed',
  'unauthorized_auth_user_deleted'
);