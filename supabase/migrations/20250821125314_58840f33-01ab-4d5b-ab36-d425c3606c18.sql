-- Find and remove any remaining problematic security definer views
-- First check if any views exist with security definer
SELECT viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND definition LIKE '%SECURITY DEFINER%';

-- Drop any remaining views that might be causing issues
DROP VIEW IF EXISTS public.safe_admin_view CASCADE;

-- Create a function to list all views for debugging
CREATE OR REPLACE FUNCTION public.list_all_views()
RETURNS TABLE(view_name text, view_definition text)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewname::text, definition::text
  FROM pg_views 
  WHERE schemaname = 'public';
$$;