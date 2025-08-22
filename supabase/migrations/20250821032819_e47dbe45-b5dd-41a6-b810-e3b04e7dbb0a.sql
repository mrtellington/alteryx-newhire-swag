-- Complete inventory RLS protection by adding policies for INSERT, UPDATE, DELETE operations
-- Only system admins should be able to modify inventory

-- Policy to allow only system admins to insert inventory
CREATE POLICY "Only system admins can insert inventory" 
ON public.inventory 
FOR INSERT 
WITH CHECK (public.is_system_admin());

-- Policy to allow only system admins to update inventory
CREATE POLICY "Only system admins can update inventory" 
ON public.inventory 
FOR UPDATE 
USING (public.is_system_admin()) 
WITH CHECK (public.is_system_admin());

-- Policy to allow only system admins to delete inventory
CREATE POLICY "Only system admins can delete inventory" 
ON public.inventory 
FOR DELETE 
USING (public.is_system_admin());