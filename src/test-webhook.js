// Temporary script to fix Christian and Tejal's auth accounts using the updated webhook
import { supabase } from './integrations/supabase/client.js';

const fixUsers = async () => {
  const usersToFix = [
    {
      email: 'christian.houston@whitestonebranding.com',
      full_name: 'Christian Houston',
      first_name: 'Christian',
      last_name: 'Houston'
    },
    {
      email: 'tejal.makuck@whitestonebranding.com',
      full_name: 'Tejal Makuck',
      first_name: 'Tejal',
      last_name: 'Makuck'
    }
  ];

  for (const user of usersToFix) {
    try {
      console.log(`Fixing auth for: ${user.email}`);
      
      const { data, error } = await supabase.functions.invoke('cognito-webhook', {
        body: user
      });

      if (error) {
        console.error(`Error fixing ${user.email}:`, error);
      } else {
        console.log(`Fixed ${user.email}:`, data);
      }
    } catch (err) {
      console.error(`Exception fixing ${user.email}:`, err);
    }
  }

  // Verify the fixes
  console.log('\nVerifying auth user creation...');
  const { data: users, error } = await supabase
    .from('users')
    .select('email, auth_user_id')
    .in('email', ['christian.houston@whitestonebranding.com', 'tejal.makuck@whitestonebranding.com']);

  if (error) {
    console.error('Error checking users:', error);
  } else {
    console.log('Current user states:', users);
  }
};

fixUsers();