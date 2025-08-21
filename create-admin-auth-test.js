// Script to create auth accounts for admin users
import { supabase } from './src/integrations/supabase/client.js';

const createAdminAuth = async () => {
  try {
    console.log('Creating auth accounts for admin users...');
    
    const { data, error } = await supabase.functions.invoke('create-admin-auth', {
      body: {}
    });

    if (error) {
      console.error('Error creating admin auth:', error);
    } else {
      console.log('Admin auth creation completed:', data);
      
      // Display results
      console.log(`\n📊 RESULTS:`);
      console.log(`Total processed: ${data.processed}`);
      console.log(`Successful: ${data.successful}`);
      console.log(`Failed: ${data.failed}`);
      
      if (data.results && data.results.length > 0) {
        console.log('\n🔐 ADMIN ACCOUNTS CREATED:');
        data.results.forEach(result => {
          if (result.success) {
            console.log(`✅ ${result.email}`);
            console.log(`   Auth ID: ${result.auth_user_id}`);
            console.log(`   Temp Password: ${result.temp_password}`);
            console.log('');
          } else {
            console.log(`❌ ${result.email}: ${result.error}`);
          }
        });
      }
    }
  } catch (err) {
    console.error('Exception creating admin auth:', err);
  }

  // Verify admin users now have auth accounts
  console.log('\nVerifying admin users have auth accounts...');
  const { data: adminUsers, error: checkError } = await supabase
    .from('admin_users')
    .select('email, user_id, active')
    .eq('active', true);

  if (checkError) {
    console.error('Error checking admin users:', checkError);
  } else {
    console.log('\n📋 ADMIN USERS STATUS:');
    adminUsers.forEach(user => {
      const status = user.user_id ? '✅ Has Auth' : '❌ No Auth';
      console.log(`${status} ${user.email}`);
    });
  }
};

createAdminAuth();