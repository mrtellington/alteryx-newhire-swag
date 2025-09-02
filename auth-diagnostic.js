// Enhanced diagnostic script to safely examine auth state
import { supabase } from './src/integrations/supabase/client.js';

const runDiagnostic = async () => {
  console.log('🔍 Running comprehensive auth diagnostic...\n');
  
  try {
    // 1. Count users in database
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, auth_user_id, invited, order_submitted')
      .eq('invited', true);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`📊 Total invited users in database: ${users.length}`);
    
    // 2. Analyze user states
    const usersWithAuth = users.filter(u => u.auth_user_id);
    const usersWithoutAuth = users.filter(u => !u.auth_user_id);
    const usersWhoOrdered = users.filter(u => u.order_submitted);
    const usersNotOrdered = users.filter(u => !u.order_submitted);
    
    console.log(`✅ Users with auth_user_id: ${usersWithAuth.length}`);
    console.log(`❌ Users without auth_user_id: ${usersWithoutAuth.length}`);
    console.log(`📦 Users who ordered: ${usersWhoOrdered.length}`);
    console.log(`⏳ Users not ordered: ${usersNotOrdered.length}\n`);
    
    // 3. Check auth.users table (this will require service key)
    console.log('🔑 Checking auth.users table (requires admin access)...');
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.log('⚠️  Cannot access auth.users directly (need service key)');
        console.log('   This is normal - will check during processing\n');
      } else {
        console.log(`🔐 Total auth users: ${authUsers.users.length}`);
        
        // Find potential phantom accounts
        const authEmails = authUsers.users.map(u => u.email?.toLowerCase());
        const dbEmails = users.map(u => u.email.toLowerCase());
        
        const phantomAuths = authUsers.users.filter(u => 
          u.email && !dbEmails.includes(u.email.toLowerCase())
        );
        
        const missingAuths = users.filter(u => 
          !authEmails.includes(u.email.toLowerCase())
        );
        
        console.log(`👻 Potential phantom auth accounts: ${phantomAuths.length}`);
        console.log(`🆕 Users needing auth creation: ${missingAuths.length}\n`);
        
        if (phantomAuths.length > 0) {
          console.log('👻 Phantom auth accounts:');
          phantomAuths.forEach((user, i) => {
            console.log(`   ${i + 1}. ${user.email} (ID: ${user.id})`);
          });
          console.log('');
        }
      }
    } catch (authCheckError) {
      console.log('⚠️  Auth check requires service key - will verify during processing\n');
    }
    
    // 4. Show sample users for batch testing
    const testCandidates = usersWithoutAuth
      .filter(u => u.email !== 'alex.schnetzer@alteryx.com')
      .slice(0, 5);
    
    console.log(`🧪 Suggested batch test candidates (${testCandidates.length}):`);
    testCandidates.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email} (ordered: ${user.order_submitted})`);
    });
    console.log('');
    
    // 5. Recommendations
    console.log('📋 RECOMMENDATIONS:');
    if (usersWithoutAuth.length === 0) {
      console.log('✅ All users have auth accounts - no action needed!');
    } else {
      console.log(`1. Run batch test with ${Math.min(testCandidates.length, 3)} users first`);
      console.log('2. If batch test succeeds, process remaining users');
      console.log('3. Verify magic link authentication works');
      console.log('4. Monitor for any issues before declaring success');
    }
    console.log('');
    
    // 6. Security check
    console.log('🔒 SECURITY NOTES:');
    console.log('- Only @alteryx.com and @whitestonebranding.com emails allowed');
    console.log('- Users who already ordered will keep existing auth status');
    console.log('- All operations are logged in security_events table');
    console.log('- Function has rollback capabilities for safety');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
};

runDiagnostic();