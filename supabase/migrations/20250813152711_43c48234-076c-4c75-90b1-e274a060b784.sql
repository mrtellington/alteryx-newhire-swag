-- Add tee_size column to orders table
ALTER TABLE public.orders 
ADD COLUMN tee_size text;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.tee_size IS 'The selected tee size for the order (XS, S, M, L, XL, 2XL, 3XL, 4XL)';