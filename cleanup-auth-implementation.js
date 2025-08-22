// Cleanup script to run the auth cleanup after simplification
async function runAuthCleanup() {
  console.log('🧹 Running auth user cleanup...');
  
  try {
    const response = await fetch('https://emnemfewmpjczkgwzrjv.supabase.co/functions/v1/cleanup-auth-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    console.log('Cleanup result:', result);
    
    if (result.deleted_users && result.deleted_users.length > 0) {
      console.log('✅ Successfully cleaned up auth users:', result.deleted_users);
    } else {
      console.log('✅ No unauthorized auth users found to clean up');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the cleanup
runAuthCleanup();