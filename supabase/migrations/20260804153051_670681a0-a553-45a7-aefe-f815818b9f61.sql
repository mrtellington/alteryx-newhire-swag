CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON public.users (lower(email));

CREATE OR REPLACE FUNCTION public.ensure_user_record()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  umeta jsonb;
  existing public.users%ROWTYPE;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT lower(u.email), COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    INTO uemail, umeta
  FROM auth.users u WHERE u.id = uid;

  IF uemail IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No email on account');
  END IF;

  IF NOT (uemail LIKE '%@alteryx.com' OR uemail LIKE '%@whitestonebranding.com') THEN
    RETURN jsonb_build_object('success', false, 'error', 'domain_not_allowed');
  END IF;

  SELECT * INTO existing FROM public.users WHERE lower(email) = uemail;

  IF FOUND THEN
    IF existing.auth_user_id IS DISTINCT FROM uid THEN
      UPDATE public.users SET auth_user_id = uid WHERE id = existing.id;
    END IF;
    RETURN jsonb_build_object('success', true, 'created', false, 'user_id', existing.id, 'order_submitted', COALESCE(existing.order_submitted, false));
  END IF;

  INSERT INTO public.users (email, full_name, first_name, last_name, invited, auth_user_id, shipping_address)
  VALUES (
    uemail,
    COALESCE(NULLIF(umeta->>'full_name',''), split_part(uemail,'@',1)),
    NULLIF(umeta->>'first_name',''),
    NULLIF(umeta->>'last_name',''),
    true,
    uid,
    '{}'::jsonb
  )
  ON CONFLICT (lower(email)) DO UPDATE SET auth_user_id = uid
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('success', true, 'created', true, 'user_id', new_id, 'order_submitted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_record() TO authenticated;