-- Add missing SELECT policy for admins on orders
CREATE POLICY "Admins can select all orders"
ON public.orders
FOR SELECT
USING (is_current_user_admin());