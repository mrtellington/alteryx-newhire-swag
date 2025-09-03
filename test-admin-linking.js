// Test admin linking and Alex login
import { supabase } from './src/integrations/supabase/client.js';

const runAdminLinking = async () => {
  console.log('🔗 Running admin auth linking...');
  
  try {
    // First, check current admin users without auth
    console.log('📊 Checking admin users needing auth accounts...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('email, auth_user_id, active')
      .eq('active', true)
      .is('auth_user_id', null);

    if (adminError) {
      console.error('❌ Error checking admin users:', adminError);
      return;
    }

    console.log(`Found ${adminUsers.length} admin users needing auth accounts:`);
    adminUsers.forEach(admin => {
      console.log(`  - ${admin.email}`);
    });

    // Run the create-admin-auth function
    console.log('\n🔧 Running create-admin-auth function...');
    const { data, error } = await supabase.functions.invoke('create-admin-auth');
    
    if (error) {
      console.error('❌ Function error:', error);
      return;
    }
    
    console.log('✅ Admin auth creation completed!');
    console.log(`📊 Results:`);
    console.log(`   - Processed: ${data.processed}`);
    console.log(`   - Successful: ${data.successful}`);
    console.log(`   - Failed: ${data.failed}`);
    
    if (data.results && data.results.length > 0) {
      console.log('\n📝 Detailed results:');
      data.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.email}`);
        if (result.auth_user_id) {
          console.log(`     🔑 Auth ID: ${result.auth_user_id}`);
        }
        if (result.temp_password) {
          console.log(`     🔐 Temp Password: ${result.temp_password}`);
        }
        if (result.error) {
          console.log(`     ❗ Error: ${result.error}`);
        }
      });
    }

    // Test Alex's authentication capability
    console.log('\n🎯 Testing Alex Schnetzer auth capability...');
    const alexEmail = 'alex.schnetzer@alteryx.com';
    
    // Check if Alex has auth_user_id
    const { data: alexUser, error: alexError } = await supabase
      .from('users')
      .select('email, auth_user_id, invited, order_submitted')
      .eq('email', alexEmail)
      .single();

    if (alexError) {
      console.error('❌ Error checking Alex:', alexError);
    } else if (alexUser) {
      console.log(`✅ Alex Schnetzer status:`);
      console.log(`   - Email: ${alexUser.email}`);
      console.log(`   - Auth ID: ${alexUser.auth_user_id}`);
      console.log(`   - Invited: ${alexUser.invited}`);
      console.log(`   - Order Submitted: ${alexUser.order_submitted}`);
      
      if (alexUser.auth_user_id) {
        console.log('🎉 Alex should now be able to use magic links!');
      } else {
        console.log('⚠️  Alex still missing auth_user_id - needs manual fixing');
      }
    }

    console.log('\n✅ Admin linking process completed!');
    
    return data;
    
  } catch (err) {
    console.error('❌ Exception during admin linking:', err);
  }
};

runAdminLinking();