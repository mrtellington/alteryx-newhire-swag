-- Add first_name and last_name columns to users table
ALTER TABLE public.users 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Update existing users to split full_name into first_name and last_name where possible
UPDATE public.users 
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
    THEN split_part(full_name, ' ', 1)
    ELSE full_name
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE NULL
  END;