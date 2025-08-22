-- Update the imported user with correct first and last names
UPDATE public.users 
SET 
  first_name = 'Christian',
  last_name = 'Houston',
  full_name = 'Christian Houston'
WHERE email = 'christian.houston@whitestonebranding.com';