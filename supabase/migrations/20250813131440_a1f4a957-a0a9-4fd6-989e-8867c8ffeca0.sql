-- Add INSERT policy for orders table to prevent unauthorized order creation
-- This policy ensures only authenticated users can create their own orders

CREATE POLICY "Users can create their own orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User can only create orders for themselves
  auth.uid() = user_id 
  AND 
  -- User must exist and be invited (additional security check)
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND invited = true 
    AND order_submitted = false
  )
);