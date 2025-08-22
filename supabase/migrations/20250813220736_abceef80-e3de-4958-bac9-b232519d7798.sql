-- Step 1: Update users table to link to auth.users
-- First, add the auth_user_id column as nullable to handle existing records
ALTER TABLE public.users ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Update the create_user_from_webhook function to handle auth user creation
CREATE OR REPLACE FUNCTION public.create_user_from_webhook(
  user_email text, 
  user_full_name text DEFAULT NULL::text, 
  user_shipping_address jsonb DEFAULT NULL::jsonb,
  auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_user_id uuid;
  create_error jsonb := null;
BEGIN
  -- Check if user already exists
  SELECT id INTO new_user_id FROM public.users WHERE email = user_email;
  
  IF FOUND THEN
    -- User already exists, update their information if needed
    UPDATE public.users 
    SET 
      full_name = COALESCE(user_full_name, users.full_name),
      shipping_address = COALESCE(user_shipping_address, users.shipping_address),
      auth_user_id = COALESCE(auth_user_id, users.auth_user_id),
      invited = true
    WHERE email = user_email
    RETURNING id INTO new_user_id;
    
    RETURN jsonb_build_object(
      'userId', new_user_id,
      'createError', null,
      'message', 'User updated successfully'
    );
  END IF;

  -- Validate email domain
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com') THEN
    create_error := jsonb_build_object(
      'code', 'INVALID_DOMAIN',
      'message', 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed'
    );
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END IF;

  -- Use provided auth_user_id or generate a new UUID for the user
  new_user_id := COALESCE(auth_user_id, gen_random_uuid());

  -- Create new user in public.users table
  BEGIN
    INSERT INTO public.users (
      id,
      auth_user_id,
      email, 
      full_name, 
      shipping_address, 
      invited,
      created_at
    ) VALUES (
      new_user_id,
      auth_user_id,
      user_email, 
      user_full_name, 
      user_shipping_address, 
      true,
      now()
    );
    
    RETURN jsonb_build_object(
      'userId', new_user_id,
      'createError', null,
      'message', 'User created successfully'
    );
    
  EXCEPTION WHEN others THEN
    create_error := jsonb_build_object(
      'code', SQLSTATE,
      'message', SQLERRM
    );
    
    RETURN jsonb_build_object(
      'userId', null,
      'createError', create_error
    );
  END;
END;
$function$;

-- Step 3: Update RLS policies to work with both auth users and non-auth users
-- First drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile if invited and allowed domain" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile if authenticated and invited" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create new policies that work with both auth and non-auth users
CREATE POLICY "Users can view their own profile if invited and allowed domain" ON public.users
FOR SELECT 
USING (
  (
    -- Allow if authenticated user matches auth_user_id
    (auth.uid() IS NOT NULL AND auth.uid() = auth_user_id AND invited = true AND 
     ((lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@alteryx.com'::text) OR 
      (lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@whitestonebranding.com'::text)))
  ) OR
  (
    -- Allow if authenticated user matches id (for backward compatibility)
    (auth.uid() IS NOT NULL AND auth.uid() = id AND invited = true AND 
     ((lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@alteryx.com'::text) OR 
      (lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@whitestonebranding.com'::text)))
  )
);

CREATE POLICY "Users can insert their own profile if authenticated and invited" ON public.users
FOR INSERT 
WITH CHECK (
  (
    -- Allow if authenticated user matches auth_user_id
    (auth.uid() IS NOT NULL AND auth.uid() = auth_user_id AND invited = true AND 
     ((lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@alteryx.com'::text) OR 
      (lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@whitestonebranding.com'::text)))
  ) OR
  (
    -- Allow if authenticated user matches id (for backward compatibility)
    (auth.uid() IS NOT NULL AND auth.uid() = id AND invited = true AND 
     ((lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@alteryx.com'::text) OR 
      (lower(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) ~~ '%@whitestonebranding.com'::text)))
  )
);

CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = auth_user_id) OR
  (auth.uid() IS NOT NULL AND auth.uid() = id)
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = auth_user_id) OR
  (auth.uid() IS NOT NULL AND auth.uid() = id)
);