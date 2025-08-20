-- Clean up auth users (except admins)
-- This needs to be done via an edge function since we can't directly access auth.users

-- Create a function to identify users that need to be removed from auth
CREATE OR REPLACE FUNCTION public.get_auth_users_to_clean()
RETURNS TABLE(email text, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    admin_emails TEXT[] := ARRAY[
        'admin@whitestonebranding.com',
        'dev@whitestonebranding.com', 
        'cecilia@whitestonebranding.com'
    ];
BEGIN
    -- Since we can't query auth.users directly, we'll use this function
    -- to identify what cleanup needs to be done
    
    -- Log that cleanup function was called
    INSERT INTO public.security_events (
        event_type,
        metadata,
        severity,
        created_at
    ) VALUES (
        'auth_cleanup_function_called',
        jsonb_build_object(
            'admin_emails_to_preserve', admin_emails
        ),
        'medium',
        now()
    );
    
    -- Return placeholder data - the actual cleanup will be done by the cleanup function
    RETURN QUERY SELECT 
        'cleanup_needed'::text as email,
        'use_cleanup_function'::text as reason;
END;
$$;