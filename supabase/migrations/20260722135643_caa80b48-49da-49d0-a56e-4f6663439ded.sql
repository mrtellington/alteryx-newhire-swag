REVOKE ALL ON FUNCTION public.place_order(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_order(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_order(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(text) TO service_role;