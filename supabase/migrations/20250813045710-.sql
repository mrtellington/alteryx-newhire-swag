-- Ensure handle_new_user inserts invited=true and create trigger + backfill existing users

-- Replace handle_new_user to set invited=true
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
begin
  insert into public.users (id, email, full_name, invited)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null), true)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Create trigger to populate public.users when a new auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- One-time backfill for existing auth users missing from public.users
INSERT INTO public.users (id, email, full_name, invited)
SELECT au.id,
       au.email,
       COALESCE(au.raw_user_meta_data ->> 'full_name', null) AS full_name,
       true AS invited
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;