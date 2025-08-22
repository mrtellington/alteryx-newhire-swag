import { supabase } from './src/integrations/supabase/client.js';

const fixTodAuth = async () => {
  console.log('🔧 Fixing Tod\'s authentication...');
  
  try {
    const { data, error } = await supabase.functions.invoke('create-auth-users', {
      body: {} // Process all users without auth_user_id
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Response:', data);
    
    // Verify Tod now has auth
    const { data: users, error: checkError } = await supabase
      .from('users')
      .select('email, auth_user_id')
      .eq('email', 'tod.ellington@whitestonebranding.com');
    
    if (checkError) {
      console.error('❌ Check error:', checkError);
    } else {
      console.log('📊 Tod\'s status:', users);
    }
    
  } catch (err) {
    console.error('❌ Exception:', err);
  }
};

fixTodAuth();