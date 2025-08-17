-- Add admin policy to allow admins to view all orders
CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (
  -- Allow admins to view all orders
  is_user_admin()
);

-- Also add admin policy to allow admins to update order details (tracking, carrier, etc.)
CREATE POLICY "Admins can update all orders" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (
  -- Allow admins to update all orders
  is_user_admin()
)
WITH CHECK (
  -- Allow admins to update all orders
  is_user_admin()
);