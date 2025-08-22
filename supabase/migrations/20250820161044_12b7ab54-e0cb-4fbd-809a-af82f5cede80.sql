-- Remove all standard users except shweta.rathaur@alteryx.com for testing
DELETE FROM public.users 
WHERE LOWER(email) != 'shweta.rathaur@alteryx.com';