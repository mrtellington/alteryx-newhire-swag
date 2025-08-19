-- First, let's disable signup entirely and clean up unauthorized users
-- Get Christian's auth user ID and delete him directly
DO $$
DECLARE
    christian_id uuid;
BEGIN
    -- Get Christian's ID from auth.users
    SELECT id INTO christian_id 
    FROM auth.users 
    WHERE email = 'christian.houston@whitestonebranding.com';
    
    -- Delete him if found
    IF christian_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = christian_id;
        
        -- Log the deletion
        INSERT INTO public.security_events (
            event_type,
            user_email,
            metadata,
            severity,
            created_at
        ) VALUES (
            'unauthorized_auth_user_force_deleted',
            'christian.houston@whitestonebranding.com',
            jsonb_build_object(
                'deleted_user_id', christian_id,
                'reason', 'Direct deletion of unauthorized user'
            ),
            'high',
            now()
        );
    END IF;
END $$;

-- Also delete any other unauthorized auth users
DO $$
DECLARE
    auth_user RECORD;
    is_admin BOOLEAN;
    is_eligible_user BOOLEAN;
BEGIN
    -- Loop through all auth users
    FOR auth_user IN 
        SELECT au.id, au.email 
        FROM auth.users au
    LOOP
        -- Check if user is an active admin
        SELECT EXISTS (
            SELECT 1 FROM public.admin_users 
            WHERE LOWER(email) = LOWER(auth_user.email) AND active = true
        ) INTO is_admin;
        
        -- Check if user is an invited user who hasn't ordered
        SELECT EXISTS (
            SELECT 1 FROM public.users 
            WHERE LOWER(email) = LOWER(auth_user.email) 
            AND invited = true 
            AND order_submitted = false
        ) INTO is_eligible_user;
        
        -- If not authorized, delete the auth user
        IF NOT (is_admin OR is_eligible_user) THEN
            -- Log the deletion
            INSERT INTO public.security_events (
                event_type,
                user_email,
                metadata,
                severity,
                created_at
            ) VALUES (
                'unauthorized_auth_user_bulk_deleted',
                auth_user.email,
                jsonb_build_object(
                    'deleted_user_id', auth_user.id,
                    'reason', 'Bulk cleanup of unauthorized users'
                ),
                'high',
                now()
            );
            
            -- Delete the auth user
            DELETE FROM auth.users WHERE id = auth_user.id;
        END IF;
    END LOOP;
END $$;