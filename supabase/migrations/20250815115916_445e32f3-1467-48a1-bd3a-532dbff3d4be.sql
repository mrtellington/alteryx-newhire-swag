-- Reset tod.ellington@gmail.com user for testing
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Find the user
    SELECT * INTO user_record FROM public.users WHERE email = 'tod.ellington@gmail.com';
    
    IF FOUND THEN
        -- Delete any orders for this user
        DELETE FROM public.orders WHERE user_id = user_record.id;
        
        -- Reset user status and clear personal data
        UPDATE public.users 
        SET 
            order_submitted = false,
            shipping_address = null,
            first_name = null,
            last_name = null,
            full_name = null
        WHERE id = user_record.id;
        
        RAISE NOTICE 'Reset user tod.ellington@gmail.com successfully';
    ELSE
        RAISE NOTICE 'User tod.ellington@gmail.com not found';
    END IF;
END $$;