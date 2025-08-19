-- Update existing users to populate first_name and last_name from full_name where missing
UPDATE public.users 
SET 
  first_name = CASE 
    WHEN first_name IS NULL OR first_name = '' THEN 
      CASE 
        WHEN full_name IS NOT NULL AND full_name != '' THEN 
          TRIM(SPLIT_PART(full_name, ' ', 1))
        ELSE NULL 
      END
    ELSE first_name
  END,
  last_name = CASE 
    WHEN last_name IS NULL OR last_name = '' THEN 
      CASE 
        WHEN full_name IS NOT NULL AND full_name != '' AND array_length(string_to_array(trim(full_name), ' '), 1) > 1 THEN 
          TRIM(SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2))
        ELSE NULL 
      END
    ELSE last_name
  END
WHERE full_name IS NOT NULL AND full_name != '';