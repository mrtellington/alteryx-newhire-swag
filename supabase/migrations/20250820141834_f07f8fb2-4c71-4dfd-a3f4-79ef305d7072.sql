-- Fix missing auth_user_id for tod.ellington@whitestonebranding.com
-- This user exists in the users table but auth_user_id is null
-- We need to link it to their auth user ID from the recent login

UPDATE users 
SET auth_user_id = 'ccdaf7bc-9418-4d24-b768-8de993329fd1'::uuid
WHERE email = 'tod.ellington@whitestonebranding.com' AND auth_user_id IS NULL;