// Enhanced test script for the improved fix-missing-auth-users function
import { supabase } from './src/integrations/supabase/client.js';

const runEnhancedAuthFix = async () => {
  console.log('🚀 Running enhanced auth fix process...');
  
  try {
    // First, check current state
    console.log('📊 Checking current state...');
    
    const { data: usersNeedingAuth, error: checkError } = await supabase
      .from('users')
      .select('id, email, full_name, auth_user_id, invited, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null);

    if (checkError) {
      console.error('❌ Error checking users:', checkError);
      return;
    }

    console.log(`📈 Users needing auth accounts: ${usersNeedingAuth?.length || 0}`);
    
    if (usersNeedingAuth?.length === 0) {
      console.log('🎉 All invited users already have auth accounts!');
      return;
    }

    // Show specific users including Alex
    const alexUser = usersNeedingAuth?.find(u => u.email === 'alex.schnetzer@alteryx.com');
    if (alexUser) {
      console.log('🎯 Alex Schnetzer is in the list - will be processed');
    } else {
      console.log('ℹ️  Alex Schnetzer not in the list (may already have auth account)');
    }

    console.log('\n🔧 Running enhanced fix-missing-auth-users function...');
    
    // Call the enhanced function
    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke('fix-missing-auth-users');
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Function error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }
    
    console.log(`✅ Enhanced fix function completed in ${duration}ms!`);
    console.log(`📊 Final Results:`);
    console.log(`   - Processed: ${data.processed} users`);
    console.log(`   - Successful: ${data.successful}`);
    console.log(`   - Errors: ${data.errors}`);
    console.log(`   - Success rate: ${((data.successful / data.processed) * 100).toFixed(1)}%`);
    
    // Show detailed results with retry information
    if (data.results && data.results.length > 0) {
      console.log('\n📝 Detailed Results:');
      
      const successful = data.results.filter(r => r.success);
      const failed = data.results.filter(r => !r.success);
      
      if (successful.length > 0) {
        console.log(`\n✅ Successfully processed (${successful.length}):`);
        successful.forEach((result, index) => {
          const retryInfo = result.retries > 0 ? ` (${result.retries} retries)` : '';
          console.log(`${index + 1}. ✅ ${result.email}${retryInfo}`);
          if (result.auth_user_id) {
            console.log(`     🔑 Auth ID: ${result.auth_user_id}`);
          }
        });
      }
      
      if (failed.length > 0) {
        console.log(`\n❌ Failed to process (${failed.length}):`);
        failed.forEach((result, index) => {
          const retryInfo = result.retries > 0 ? ` (${result.retries} retries)` : '';
          console.log(`${index + 1}. ❌ ${result.email}${retryInfo}`);
          console.log(`     ❗ Error: ${result.error}`);
          console.log(`     🔧 Action: ${result.action}`);
        });
      }
    }
    
    // Specifically check Alex Schnetzer's result
    console.log('\n🎯 Alex Schnetzer Status Check:');
    const alexResult = data.results?.find(r => r.email === 'alex.schnetzer@alteryx.com');
    if (alexResult) {
      if (alexResult.success) {
        console.log(`✅ Alex Schnetzer: Auth account created successfully!`);
        console.log(`🔑 Auth ID: ${alexResult.auth_user_id}`);
        if (alexResult.retries > 0) {
          console.log(`🔄 Required ${alexResult.retries} retries`);
        }
        console.log('🎉 Alex should now be able to use magic links!');
      } else {
        console.log(`❌ Alex Schnetzer: Failed - ${alexResult.error}`);
        console.log(`🔧 Action attempted: ${alexResult.action}`);
        if (alexResult.retries > 0) {
          console.log(`🔄 Tried ${alexResult.retries} times`);
        }
      }
    } else {
      console.log('ℹ️  Alex Schnetzer was not processed (likely already has auth account)');
    }
    
    // Final verification
    console.log('\n🔍 Final verification check...');
    
    const { data: remainingUsers, error: finalError } = await supabase
      .from('users')
      .select('email, auth_user_id')
      .eq('invited', true)
      .is('auth_user_id', null);
    
    if (finalError) {
      console.error('❌ Final verification error:', finalError);
    } else {
      console.log(`📊 Users still needing auth accounts: ${remainingUsers?.length || 0}`);
      if (remainingUsers && remainingUsers.length > 0) {
        console.log('📋 Remaining users:', remainingUsers.slice(0, 5).map(u => u.email).join(', '));
        if (remainingUsers.length > 5) {
          console.log(`   ... and ${remainingUsers.length - 5} more`);
        }
      } else {
        console.log('🎉 All invited users now have auth accounts!');
      }
    }
    
    console.log('\n🏁 Enhanced auth fix process completed!');
    return data;
    
  } catch (err) {
    console.error('❌ Exception during enhanced auth fix:', err);
    console.error('Full error:', JSON.stringify(err, null, 2));
  }
};

runEnhancedAuthFix();