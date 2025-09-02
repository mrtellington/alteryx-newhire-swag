// Script to process ALL users after Alex test succeeds
import { supabase } from './src/integrations/supabase/client.js';

const processAllUsers = async () => {
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
      
      // Show successful links first
      const successfulResults = data.results.filter(r => r.success);
      const errorResults = data.results.filter(r => !r.success);
      
      if (successfulResults.length > 0) {
        console.log(`\n✅ SUCCESSFUL LINKS (${successfulResults.length}):`);
        successfulResults.forEach((result, index) => {
          console.log(`${index + 1}. ✅ ${result.email}: ${result.action}`);
          if (result.auth_user_id) {
            console.log(`     🔑 Auth ID: ${result.auth_user_id}`);
          }
        });
      }
      
      if (errorResults.length > 0) {
        console.log(`\n❌ ERRORS (${errorResults.length}):`);
        errorResults.forEach((result, index) => {
          console.log(`${index + 1}. ❌ ${result.email}: ${result.action}`);
          if (result.error) {
            console.log(`     ❗ Error: ${result.error}`);
          }
        });
      }
      
      // Show summary by action type
      console.log('\n📊 Summary by action:');
      const actionCounts = {};
      data.results.forEach(result => {
        const key = result.success ? `✅ ${result.action}` : `❌ ${result.action}`;
        actionCounts[key] = (actionCounts[key] || 0) + 1;
      });
      
      Object.entries(actionCounts).forEach(([action, count]) => {
        console.log(`   ${action}: ${count} users`);
      });
    }
    
    // Final verification - check for remaining users without auth_user_id
    console.log('\n🔍 Final verification...');
    const { data: remainingUsers, error: verifyError } = await supabase
      .from('users')
      .select('email, invited, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null);
    
    if (verifyError) {
      console.error('❌ Error during verification:', verifyError);
    } else {
      console.log(`📊 Users still without auth accounts: ${remainingUsers?.length || 0}`);
      if (remainingUsers && remainingUsers.length > 0) {
        console.log('📝 Remaining users:');
        remainingUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.email} (ordered: ${user.order_submitted})`);
        });
      } else {
        console.log('🎉 ALL USERS NOW HAVE AUTH ACCOUNTS! 🎉');
        console.log('✅ Everyone should be able to login with magic links now!');
      }
    }
    
    // Special check for Alex
    console.log('\n🔍 Alex Schnetzer verification...');
    const { data: alex, error: alexError } = await supabase
      .from('users')
      .select('email, auth_user_id, invited, order_submitted')
      .eq('email', 'alex.schnetzer@alteryx.com')
      .single();
    
    if (alexError) {
      console.error('❌ Error checking Alex:', alexError);
    } else {
      console.log(`✅ Alex status: auth_user_id=${alex.auth_user_id}, invited=${alex.invited}, ordered=${alex.order_submitted}`);
      if (alex.auth_user_id) {
        console.log('🎯 Alex should now be able to login!');
      }
    }
    
  } catch (err) {
    console.error('❌ Exception:', err);
  }
};

processAllUsers();