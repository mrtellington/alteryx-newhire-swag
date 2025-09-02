// Safe batch test script - processes only 3-5 users for verification
import { supabase } from './src/integrations/supabase/client.js';

const runBatchTest = async () => {
  console.log('🧪 Running SAFE BATCH TEST for auth linking...\n');
  
  try {
    // Get a small batch of test users (excluding Alex)
    const { data: testUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, auth_user_id, invited, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null)
      .neq('email', 'alex.schnetzer@alteryx.com')
      .limit(3); // Start with just 3 users
    
    if (fetchError) {
      console.error('❌ Error fetching test users:', fetchError);
      return;
    }
    
    if (testUsers.length === 0) {
      console.log('✅ No users need auth linking - all set!');
      return;
    }
    
    console.log(`🎯 Testing with ${testUsers.length} users:`);
    testUsers.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email} (ordered: ${user.order_submitted})`);
    });
    console.log('');
    
    // Call the edge function with specific emails
    console.log('🚀 Calling link-existing-auth-users function...');
    const { data, error } = await supabase.functions.invoke('link-existing-auth-users', {
      body: { 
        emails: testUsers.map(u => u.email),
        testMode: true // Add flag to indicate this is a test
      }
    });
    
    if (error) {
      console.error('❌ Function error:', error);
      return;
    }
    
    console.log('✅ Function completed successfully:');
    console.log(`📊 Processed: ${data.processed} users`);
    console.log(`✅ Successful: ${data.successful}`);
    console.log(`❌ Errors: ${data.errors}\n`);
    
    if (data.results && data.results.length > 0) {
      console.log('📝 Detailed results:');
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
      console.log('');
    }
    
    // Verify the changes in database
    console.log('🔍 Verifying database changes...');
    const verificationPromises = testUsers.map(async (user) => {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .select('email, auth_user_id')
        .eq('email', user.email)
        .single();
      
      return { 
        email: user.email, 
        hasAuth: updatedUser?.auth_user_id ? true : false,
        authId: updatedUser?.auth_user_id,
        error: error
      };
    });
    
    const verificationResults = await Promise.all(verificationPromises);
    
    const successCount = verificationResults.filter(r => r.hasAuth && !r.error).length;
    
    console.log(`📊 Verification results: ${successCount}/${testUsers.length} users now have auth accounts\n`);
    
    verificationResults.forEach((result, i) => {
      const status = result.hasAuth ? '✅' : '❌';
      console.log(`${i + 1}. ${status} ${result.email}: ${result.hasAuth ? 'has auth_user_id' : 'missing auth_user_id'}`);
      if (result.authId) {
        console.log(`     🔑 Auth ID: ${result.authId}`);
      }
      if (result.error) {
        console.log(`     ❗ Verification error: ${result.error.message}`);
      }
    });
    
    console.log('\n🎯 BATCH TEST RESULTS:');
    if (successCount === testUsers.length) {
      console.log('🎉 BATCH TEST SUCCESSFUL! ✅');
      console.log('📋 Next steps:');
      console.log('   1. Run magic link verification test');
      console.log('   2. If verification passes, process all remaining users');
      console.log('   3. Use: node test-auth-linking-all.js');
    } else {
      console.log('⚠️  BATCH TEST PARTIALLY FAILED');
      console.log('🔧 Review errors above before processing more users');
      console.log('💡 Check edge function logs for detailed error info');
    }
    
  } catch (error) {
    console.error('❌ Batch test failed:', error);
  }
};

runBatchTest();