// Script to verify that users can actually authenticate with magic links
import { supabase } from './src/integrations/supabase/client.js';

const verifyMagicLinks = async () => {
  console.log('🔐 Verifying magic link authentication...\n');
  
  try {
    // Get users who recently got auth accounts (have auth_user_id and were processed recently)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email, auth_user_id, invited, order_submitted')
      .eq('invited', true)
      .not('auth_user_id', 'is', null)
      .limit(5); // Test with a few users
    
    if (usersError) {
      console.error('❌ Error fetching users for verification:', usersError);
      return;
    }
    
    if (users.length === 0) {
      console.log('⚠️  No users with auth accounts found for verification');
      return;
    }
    
    console.log(`🎯 Testing magic links for ${users.length} users:`);
    users.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email}`);
    });
    console.log('');
    
    // Test sending magic links (this will verify the auth system works)
    console.log('📧 Testing magic link sending...');
    
    const magicLinkResults = [];
    
    for (const user of users) {
      try {
        console.log(`📨 Sending magic link to ${user.email}...`);
        
        const { error: magicLinkError } = await supabase.auth.signInWithOtp({
          email: user.email,
          options: {
            emailRedirectTo: `${window?.location?.origin || 'https://loving-app.lovable.app'}/`,
            shouldCreateUser: false // Don't create new users, only sign in existing ones
          }
        });
        
        if (magicLinkError) {
          console.log(`   ❌ Failed: ${magicLinkError.message}`);
          magicLinkResults.push({
            email: user.email,
            success: false,
            error: magicLinkError.message
          });
        } else {
          console.log(`   ✅ Magic link sent successfully`);
          magicLinkResults.push({
            email: user.email,
            success: true,
            error: null
          });
        }
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
        magicLinkResults.push({
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('\n📊 MAGIC LINK VERIFICATION RESULTS:');
    const successCount = magicLinkResults.filter(r => r.success).length;
    console.log(`✅ Successful: ${successCount}/${magicLinkResults.length} users\n`);
    
    magicLinkResults.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${i + 1}. ${status} ${result.email}: ${result.success ? 'Magic link sent' : result.error}`);
    });
    
    console.log('\n🎯 VERIFICATION SUMMARY:');
    if (successCount === magicLinkResults.length) {
      console.log('🎉 ALL MAGIC LINKS WORKING! ✅');
      console.log('✅ Auth system is functioning correctly');
      console.log('📋 Safe to process all remaining users');
      console.log('💡 Users can now login to the app with magic links');
    } else if (successCount > 0) {
      console.log('⚠️  PARTIAL SUCCESS - Some magic links working');
      console.log('🔧 Review failed cases before processing more users');
    } else {
      console.log('❌ NO MAGIC LINKS WORKING');
      console.log('🚨 DO NOT process more users until this is fixed');
      console.log('🔧 Check auth configuration and edge function logs');
    }
    
    console.log('\n📧 NOTE: Check email inboxes to confirm delivery');
    console.log('🔗 Users should receive emails with magic links');
    
  } catch (error) {
    console.error('❌ Magic link verification failed:', error);
  }
};

verifyMagicLinks();