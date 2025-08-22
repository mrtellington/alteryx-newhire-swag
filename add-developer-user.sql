-- Add developer user to the users table
INSERT INTO users (
  id,
  email,
  full_name,
  invited,
  shipping_address,
  created_at
) VALUES (
  '7c072e93-c879-49d2-9d0e-f7447b2d9ab8',
  'tod.ellington@whitestonebranding.com',
  'Tod Ellington',
  true,
  '123 Developer Street, Test City, CA 90210',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  invited = true;
