import { supabase } from "@/integrations/supabase/client";

export const createAllAuthUsers = async () => {
  console.log('🚀 Creating auth users for all users without auth accounts...');
  
  try {
    const { data, error } = await supabase.functions.invoke('create-auth-users', {
      body: {} // Process all users without auth_user_id
    });

    if (error) {
      console.error('❌ Error creating auth users:', error);
      return { success: false, error };
    }

    console.log('✅ Auth user creation completed!');
    console.log(`📊 Processed: ${data.processed} users`);
    console.log('📝 Detailed results:');
    
    let successCount = 0;
    let errorCount = 0;
    
    data.results.forEach((userResult: any, index: number) => {
      if (userResult.success) {
        successCount++;
        console.log(`${index + 1}. ✅ ${userResult.email}: ${userResult.action}`);
        if (userResult.auth_user_id) {
          console.log(`     🔑 Auth ID: ${userResult.auth_user_id}`);
        }
      } else {
        errorCount++;
        console.log(`${index + 1}. ❌ ${userResult.email}: ${userResult.error}`);
      }
    });

    console.log(`\n📈 Summary: ${successCount} successful, ${errorCount} errors`);
    console.log('🎉 All users should now have auth accounts and be able to login and order!');
    
    return { 
      success: true, 
      processed: data.processed, 
      successCount, 
      errorCount, 
      results: data.results 
    };

  } catch (err) {
    console.error('❌ Exception creating auth users:', err);
    return { success: false, error: err };
  }
};

// Auto-run when imported
createAllAuthUsers();