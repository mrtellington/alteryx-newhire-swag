// Script to test the link-existing-auth-users function
import { supabase } from './src/integrations/supabase/client.js';

const testAuthLinking = async () => {
  console.log('🚀 Testing auth linking function...');
  
  try {
    // First test with just Alex to verify the process works
    console.log('🔬 Testing with Alex Schnetzer first...');
    
    const { data: alexResult, error: alexError } = await supabase.functions.invoke('link-existing-auth-users', {
      body: {
        emails: ['alex.schnetzer@alteryx.com']
      }
    });
    
    if (alexError) {
      console.error('❌ Function error for Alex:', alexError);
      return;
    }
    
    console.log('✅ Alex test completed:');
    console.log(`📊 Processed: ${alexResult.processed} users`);
    console.log(`✅ Successful: ${alexResult.successful}`);
    console.log(`❌ Errors: ${alexResult.errors}`);
    
    if (alexResult.results && alexResult.results.length > 0) {
      console.log('\n📝 Alex result details:');
      alexResult.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.email}: ${result.action}`);
        if (result.auth_user_id) {
          console.log(`     🔑 Auth ID: ${result.auth_user_id}`);
        }
        if (result.error) {
          console.log(`     ❗ Error: ${result.error}`);
        }
      });
    }
    
    // If Alex worked, ask user if they want to continue with all users
    if (alexResult.successful > 0) {
      console.log('\n🎉 Alex linking successful! Ready to process all users.');
      console.log('\n📝 To process all remaining users, run:');
      console.log('   node test-auth-linking-all.js');
      
      // Verify Alex can now be found with auth_user_id
      console.log('\n🔍 Verifying Alex has auth_user_id...');
      const { data: alexUser, error: verifyError } = await supabase
        .from('users')
        .select('id, email, auth_user_id')
        .eq('email', 'alex.schnetzer@alteryx.com')
        .single();
      
      if (verifyError) {
        console.error('❌ Error verifying Alex:', verifyError);
      } else {
        console.log(`✅ Alex verification: auth_user_id = ${alexUser.auth_user_id}`);
      }
    } else {
      console.log('\n⚠️ Alex linking failed. Check the errors above.');
    }
    
  } catch (err) {
    console.error('❌ Exception:', err);
  }
};

const testAllUsers = async () => {
  console.log('🚀 Processing ALL users without auth accounts...');
  
  try {
    const { data, error } = await supabase.functions.invoke('link-existing-auth-users');
    
    if (error) {
      console.error('❌ Function error:', error);
      return;
    }
    
    console.log('✅ Function completed successfully:');
    console.log(`📊 Processed: ${data.processed} users`);
    console.log(`✅ Successful: ${data.successful}`);
    console.log(`❌ Errors: ${data.errors}`);
    
    if (data.results && data.results.length > 0) {
      console.log('\n📝 Detailed results:');
      data.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.email}: ${result.action}`);
        if (result.auth_user_id) {
          console.log(`     🔑 Auth ID: ${result.auth_user_id}`);
        }
        if (result.error) {
          console.log(`     ❗ Error: ${result.error}`);
        }
      });
      
      // Show summary by action type
      console.log('\n📊 Summary by action:');
      const actionCounts = {};
      data.results.forEach(result => {
        actionCounts[result.action] = (actionCounts[result.action] || 0) + 1;
      });
      
      Object.entries(actionCounts).forEach(([action, count]) => {
        console.log(`   ${action}: ${count} users`);
      });
    }
    
    console.log('\n🎉 All users should now be able to use magic links!');
    
    // Final verification - check for remaining users without auth_user_id
    console.log('\n🔍 Final verification...');
    const { data: remainingUsers, error: verifyError } = await supabase
      .from('users')
      .select('email')
      .eq('invited', true)
      .is('auth_user_id', null);
    
    if (verifyError) {
      console.error('❌ Error during verification:', verifyError);
    } else {
      console.log(`📊 Users still without auth accounts: ${remainingUsers?.length || 0}`);
      if (remainingUsers && remainingUsers.length > 0) {
        console.log('📝 Remaining users:');
        remainingUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.email}`);
        });
      }
    }
    
  } catch (err) {
    console.error('❌ Exception:', err);
  }
};

// Check command line args
const args = process.argv.slice(2);
if (args.includes('--all')) {
  testAllUsers();
} else {
  testAuthLinking();
}