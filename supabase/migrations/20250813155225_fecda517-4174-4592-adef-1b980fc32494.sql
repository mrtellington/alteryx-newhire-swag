-- Delete all orders
DELETE FROM orders;

-- Reset user order status so they can place orders again
UPDATE users SET order_submitted = false;