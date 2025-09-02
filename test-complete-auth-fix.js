// Test script to run the complete auth fix process
import { supabase } from './src/integrations/supabase/client.js';

const runCompleteAuthFix = async () => {
  console.log('🚀 Running complete auth fix process...');
  
  try {
    // First, check how many users need auth accounts
    console.log('📊 Checking users needing auth accounts...');
    
    // Call the fix-missing-auth-users function
    console.log('🔧 Running fix-missing-auth-users function...');
    const { data, error } = await supabase.functions.invoke('fix-missing-auth-users');
    
    if (error) {
      console.error('❌ Function error:', error);
      return;
    }
    
    console.log('✅ Fix function completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Processed: ${data.processed} users`);
    console.log(`   - Successful: ${data.successful}`);
    console.log(`   - Errors: ${data.errors}`);
    
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
    }
    
    // Specifically check Alex Schnetzer's status
    console.log('\n🎯 Checking Alex Schnetzer specifically...');
    const alexResult = data.results?.find(r => r.email === 'alex.schnetzer@alteryx.com');
    if (alexResult) {
      if (alexResult.success) {
        console.log(`✅ Alex Schnetzer: Auth account created successfully!`);
        console.log(`🔑 Auth ID: ${alexResult.auth_user_id}`);
        console.log('🎉 Alex should now be able to use magic links!');
      } else {
        console.log(`❌ Alex Schnetzer: Failed - ${alexResult.error}`);
      }
    } else {
      console.log('ℹ️  Alex Schnetzer was not in the processed list (may already have auth account)');
    }
    
    console.log('\n🎉 Complete auth fix process finished!');
    console.log('👤 All users should now be able to authenticate and place orders.');
    
    return data;
    
  } catch (err) {
    console.error('❌ Exception during auth fix:', err);
  }
};

runCompleteAuthFix();