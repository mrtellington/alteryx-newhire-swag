-- CRITICAL FIX: Update orders table RLS policy to use correct auth_user_id lookup
-- The current policy is using users.id = auth.uid() which is incorrect
-- It should use users.auth_user_id = auth.uid() to match our user table structure

-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- Create the correct INSERT policy that uses auth_user_id
CREATE POLICY "Users can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) AND 
  (EXISTS (
    SELECT 1
    FROM users
    WHERE users.auth_user_id = auth.uid() 
    AND users.invited = true 
    AND users.order_submitted = false
  ))
);

-- Also update the SELECT policy to be consistent (though this one might work due to user_id foreign key)
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

-- Log this critical fix
INSERT INTO public.security_events (
  event_type,
  user_email,
  metadata,
  severity,
  created_at
) VALUES (
  'orders_rls_policy_fixed',
  'tod.ellington@whitestonebranding.com',
  jsonb_build_object(
    'issue', 'orders_insert_policy_used_wrong_user_id_lookup',
    'fix', 'updated_to_use_auth_user_id_instead_of_id',
    'impact', 'users_can_now_successfully_place_orders'
  ),
  'high',
  now()
);