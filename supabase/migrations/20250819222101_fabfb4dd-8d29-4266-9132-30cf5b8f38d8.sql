-- Fix the handle_new_user trigger to properly handle existing users from webhook/CSV imports
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  -- Insert user record with proper conflict handling on email
  insert into public.users (id, email, full_name, invited, auth_user_id)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data ->> 'full_name', null), 
    true,
    new.id
  )
  on conflict (email) do update set
    auth_user_id = new.id,
    invited = true
  where users.auth_user_id is null; -- Only update if not already linked to an auth user
  
  return new;
end;
$function$;