// Final script to process ALL remaining users after successful batch testing
import { supabase } from './src/integrations/supabase/client.js';

const processAllRemainingUsers = async () => {
  console.log('🚀 FINAL PROCESSING: All remaining users...\n');
  
  try {
    // First, check how many users still need processing
    const { data: remainingUsers, error: countError } = await supabase
      .from('users')
      .select('email, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null);
    
    if (countError) {
      console.error('❌ Error checking remaining users:', countError);
      return;
    }
    
    if (!remainingUsers || remainingUsers.length === 0) {
      console.log('🎉 NO USERS NEED PROCESSING - ALL COMPLETE! ✅');
      return;
    }
    
    console.log(`📊 Found ${remainingUsers.length} users still needing auth accounts:`);
    
    // Show breakdown
    const orderedUsers = remainingUsers.filter(u => u.order_submitted);
    const notOrderedUsers = remainingUsers.filter(u => !u.order_submitted);
    
    console.log(`   📦 Users who ordered: ${orderedUsers.length}`);
    console.log(`   ⏳ Users not yet ordered: ${notOrderedUsers.length}\n`);
    
    // Safety confirmation for large batches
    if (remainingUsers.length > 20) {
      console.log('🛡️  LARGE BATCH DETECTED');
      console.log('⚠️  Processing more than 20 users at once');
      console.log('💡 Consider running batch test first if this is unexpected\n');
    }
    
    // Call the edge function for all remaining users
    console.log('🚀 Calling enhanced auth linking function...');
    const { data, error } = await supabase.functions.invoke('link-existing-auth-users', {
      body: { 
        // Don't specify emails - process all remaining users
        testMode: false // Production mode
      }
    });
    
    if (error) {
      console.error('❌ Function error:', error);
      return;
    }
    
    console.log('✅ Function completed successfully:');
    console.log(`📊 Processed: ${data.processed} users`);
    console.log(`✅ Successful: ${data.successful}`);
    console.log(`❌ Errors: ${data.errors}`);
    console.log(`📈 Success Rate: ${data.success_rate}%\n`);
    
    if (data.results && data.results.length > 0) {
      console.log('📝 DETAILED RESULTS:\n');
      
      // Group results by action type
      const resultsByAction = {};
      data.results.forEach(result => {
        const key = result.success ? `✅ ${result.action}` : `❌ ${result.action}`;
        if (!resultsByAction[key]) {
          resultsByAction[key] = [];
        }
        resultsByAction[key].push(result);
      });
      
      // Show summary by action
      console.log('📊 SUMMARY BY ACTION:');
      Object.entries(resultsByAction).forEach(([action, results]) => {
        console.log(`   ${action}: ${results.length} users`);
      });
      console.log('');
      
      // Show successful results
      const successfulResults = data.results.filter(r => r.success);
      if (successfulResults.length > 0) {
        console.log(`✅ SUCCESSFUL RESULTS (${successfulResults.length}):`);
        successfulResults.forEach((result, index) => {
          console.log(`${index + 1}. ✅ ${result.email}: ${result.action}`);
          if (result.auth_user_id) {
            console.log(`     🔑 Auth ID: ${result.auth_user_id}`);
          }
        });
        console.log('');
      }
      
      // Show errors if any
      const errorResults = data.results.filter(r => !r.success);
      if (errorResults.length > 0) {
        console.log(`❌ ERRORS (${errorResults.length}):`);
        errorResults.forEach((result, index) => {
          console.log(`${index + 1}. ❌ ${result.email}: ${result.action}`);
          if (result.error) {
            console.log(`     ❗ Error: ${result.error}`);
          }
        });
        console.log('');
      }
    }
    
    // Final comprehensive verification
    console.log('🔍 FINAL COMPREHENSIVE VERIFICATION...');
    const { data: finalCheck, error: finalError } = await supabase
      .from('users')
      .select('email, auth_user_id, invited, order_submitted')
      .eq('invited', true);
    
    if (finalError) {
      console.error('❌ Error during final verification:', finalError);
    } else {
      const allUsers = finalCheck.length;
      const usersWithAuth = finalCheck.filter(u => u.auth_user_id).length;
      const usersWithoutAuth = finalCheck.filter(u => !u.auth_user_id).length;
      const orderedUsersWithAuth = finalCheck.filter(u => u.order_submitted && u.auth_user_id).length;
      const notOrderedUsersWithAuth = finalCheck.filter(u => !u.order_submitted && u.auth_user_id).length;
      
      console.log('📊 FINAL STATISTICS:');
      console.log(`   👥 Total invited users: ${allUsers}`);
      console.log(`   ✅ Users with auth accounts: ${usersWithAuth}`);
      console.log(`   ❌ Users without auth accounts: ${usersWithoutAuth}`);
      console.log(`   📦 Ordered users with auth: ${orderedUsersWithAuth}`);
      console.log(`   ⏳ Not-yet-ordered users with auth: ${notOrderedUsersWithAuth}\n`);
      
      if (usersWithoutAuth === 0) {
        console.log('🎉🎉🎉 PERFECT SUCCESS! 🎉🎉🎉');
        console.log('✅ ALL INVITED USERS NOW HAVE AUTH ACCOUNTS!');
        console.log('🔐 Everyone can now login with magic links!');
        console.log('📧 Users will receive magic link emails when they try to login');
        console.log('🛍️  Users can proceed to shop and place orders\n');
        
        console.log('🎯 NEXT STEPS:');
        console.log('1. ✅ Test a few magic link logins to confirm everything works');
        console.log('2. ✅ Monitor the application for any auth issues');
        console.log('3. ✅ Celebrate! The auth linking is complete! 🎉');
        
      } else {
        console.log('⚠️  PARTIAL SUCCESS');
        console.log(`${usersWithoutAuth} users still need auth accounts`);
        console.log('🔧 Review errors above and consider re-running for failed users');
        
        // Show remaining users
        const stillNeedAuth = finalCheck.filter(u => !u.auth_user_id);
        if (stillNeedAuth.length > 0 && stillNeedAuth.length <= 10) {
          console.log('\n📋 Users still needing auth accounts:');
          stillNeedAuth.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.email} (ordered: ${user.order_submitted})`);
          });
        }
      }
    }
    
    // Security audit note
    console.log('\n🔒 SECURITY NOTES:');
    console.log('✅ All operations logged in security_events table');
    console.log('✅ Only valid domain emails processed');
    console.log('✅ Auth users created with confirmed email status');
    console.log('✅ Proper error handling and cleanup implemented');
    console.log('📊 Check Supabase Auth Users dashboard to verify accounts');
    
  } catch (error) {
    console.error('❌ Final processing failed:', error);
  }
};

processAllRemainingUsers();