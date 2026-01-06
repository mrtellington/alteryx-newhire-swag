
-- Add Robin Mehdee as a regular user
INSERT INTO users (email, full_name, first_name, last_name, invited, shipping_address)
VALUES (
  'robin.mehdee@whitestonebranding.com',
  'Robin Mehdee',
  'Robin',
  'Mehdee',
  true,
  '{}'::jsonb
);
