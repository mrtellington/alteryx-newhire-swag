// Direct test of the create-auth-users function
import { supabase } from './src/integrations/supabase/client.js';

const testFunction = async () => {
  console.log('🚀 Testing create-auth-users function directly...');
  
  try {
    // Test with detailed logging
    const { data, error } = await supabase.functions.invoke('create-auth-users', {
      body: {},
    });

    if (error) {
      console.error('❌ Function error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ Function response:', data);
    console.log('Response details:', JSON.stringify(data, null, 2));
    
    // Check database immediately after
    const { data: remaining, error: dbError } = await supabase
      .from('users')
      .select('email, auth_user_id')
      .is('auth_user_id', null)
      .eq('invited', true);
    
    if (dbError) {
      console.error('❌ Database check error:', dbError);
    } else {
      console.log(`📊 Users still without auth: ${remaining.length}`);
      if (remaining.length > 0) {
        console.log('Still missing:', remaining.map(u => u.email));
      }
    }
    
  } catch (err) {
    console.error('❌ Exception:', err);
    console.error('Full error:', JSON.stringify(err, null, 2));
  }
};

testFunction();