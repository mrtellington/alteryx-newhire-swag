-- Re-enable the validate_auth_user trigger to restore security controls
-- This trigger ensures only authorized users (admins or invited users) can create auth accounts

CREATE TRIGGER validate_auth_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_auth_user();