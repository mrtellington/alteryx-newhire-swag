-- Add admin policy for updating orders table
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
USING (is_current_user_admin());