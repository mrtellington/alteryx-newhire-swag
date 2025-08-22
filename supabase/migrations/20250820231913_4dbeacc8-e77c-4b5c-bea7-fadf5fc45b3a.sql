-- Update inventory count to 1000
UPDATE public.inventory 
SET quantity_available = 1000 
WHERE product_id = 'ba6fc603-5b94-4726-a876-50be89d6ec70';