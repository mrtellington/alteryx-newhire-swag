// Script to test the fix-missing-auth-users function
import { supabase } from './src/integrations/supabase/client.js';

const testFixFunction = async () => {
  console.log('🚀 Testing fix-missing-auth-users function...');
  
  try {
    const { data, error } = await supabase.functions.invoke('fix-missing-auth-users');
    
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
    }
    
    console.log('\n🎉 All users should now be able to use magic links!');
    
  } catch (err) {
    console.error('❌ Exception:', err);
  }
};

testFixFunction();