
-- 1) Add SET search_path = public to functions currently missing it
ALTER FUNCTION public.create_user_from_webhook(text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.place_order(uuid, text) SET search_path = public;
ALTER FUNCTION public.is_system_admin() SET search_path = public;
ALTER FUNCTION public.log_security_event(text, uuid, jsonb) SET search_path = public;

-- 2) Revoke broad EXECUTE from PUBLIC/anon/authenticated on sensitive SECURITY DEFINER functions
-- Keep only service_role (and specifically re-grant authenticated where the app requires it)

REVOKE ALL ON FUNCTION public.force_update_admin_password() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.test_policy_for_dev() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_unauthorized_auth_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_missing_auth_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_existing_auth_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nuclear_reset_all_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_user_from_webhook(text, text, text, text, jsonb, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_user_from_webhook(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_all_views() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debug_user_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_secure_readonly_admin(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authenticate_secure_readonly_admin(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_detailed_security_event(text, uuid, security_event_severity, jsonb, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_security_dashboard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_all_orders_for_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_slack_on_events(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, jsonb) FROM PUBLIC, anon;

-- Re-grant execute to authenticated for functions the app calls as signed-in user
GRANT EXECUTE ON FUNCTION public.get_security_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_orders_for_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_detailed_security_event(text, uuid, security_event_severity, jsonb, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_user_access() TO authenticated;
