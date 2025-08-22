-- Delete users that don't have auth_user_id (the failed imports)
DELETE FROM public.users 
WHERE auth_user_id IS NULL 
AND email NOT IN ('test.user1@alteryx.com', 'test18@alteryx.com');