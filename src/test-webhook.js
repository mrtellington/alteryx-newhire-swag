// Script to create auth users for all users without auth accounts
import { supabase } from './integrations/supabase/client.js';

const createAllAuthUsers = async () => {
  try {
    console.log('Creating auth users for all users without auth accounts...');
    
    const { data, error } = await supabase.functions.invoke('create-auth-users', {
      body: {} // Process all users without auth_user_id
    });

    if (error) {
      console.error('Error creating auth users:', error);
    } else {
      console.log('Auth user creation completed:', data);
      console.log(`Processed: ${data.processed} users`);
      console.log('Results:', data.results);
    }
  } catch (err) {
    console.error('Exception creating auth users:', err);
  }

  // Verify all users now have auth accounts
  console.log('\nVerifying all users have auth accounts...');
  const { data: usersWithoutAuth, error: checkError } = await supabase
    .from('users')
    .select('email, auth_user_id')
    .is('auth_user_id', null)
    .eq('invited', true);

  if (checkError) {
    console.error('Error checking users:', checkError);
  } else {
    console.log(`Users still without auth accounts: ${usersWithoutAuth.length}`);
    if (usersWithoutAuth.length > 0) {
      console.log('Users without auth:', usersWithoutAuth.map(u => u.email));
    } else {
      console.log('✅ All users now have auth accounts!');
    }
  }
};

createAllAuthUsers();