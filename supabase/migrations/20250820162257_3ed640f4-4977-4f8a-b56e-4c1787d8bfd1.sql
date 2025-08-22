-- Update Christian and Tejal with auth users for login capability
DO $$ 
DECLARE
    christian_auth_id uuid;
    tejal_auth_id uuid;
BEGIN
    -- Create auth user for Christian
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change_token_new,
        recovery_token
    ) VALUES (
        gen_random_uuid(),
        'christian.houston@whitestonebranding.com',
        crypt('temp_password_' || gen_random_uuid()::text, gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Christian Houston", "invited_via": "manual_fix"}'::jsonb,
        now(),
        now(),
        '',
        '',
        ''
    ) RETURNING id INTO christian_auth_id;

    -- Update Christian's database record with auth_user_id
    UPDATE public.users 
    SET auth_user_id = christian_auth_id 
    WHERE email = 'christian.houston@whitestonebranding.com';

    -- Create auth user for Tejal
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change_token_new,
        recovery_token
    ) VALUES (
        gen_random_uuid(),
        'tejal.makuck@whitestonebranding.com',
        crypt('temp_password_' || gen_random_uuid()::text, gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Tejal Makuck", "invited_via": "manual_fix"}'::jsonb,
        now(),
        now(),
        '',
        '',
        ''
    ) VALUES (
        gen_random_uuid(),
        'tejal.makuck@whitestonebranding.com',
        crypt('temp_password_' || gen_random_uuid()::text, gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Tejal Makuck", "invited_via": "manual_fix"}'::jsonb,
        now(),
        now(),
        '',
        '',
        ''
    ) RETURNING id INTO tejal_auth_id;

    -- Update Tejal's database record with auth_user_id
    UPDATE public.users 
    SET auth_user_id = tejal_auth_id 
    WHERE email = 'tejal.makuck@whitestonebranding.com';

    RAISE NOTICE 'Successfully created auth users and linked them to database records';
END $$;