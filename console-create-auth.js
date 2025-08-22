// Copy and paste this into your browser console on alteryxnewhire.com
// Or run it directly here

async function createAuthUsersNow() {
  console.log('🚀 Starting auth user creation...');
  
  try {
    const response = await fetch('https://emnemfewmpjczkgwzrjv.supabase.co/functions/v1/create-auth-users', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA',
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error:', result);
      return;
    }

    console.log('✅ Success! Processed:', result.processed, 'users');
    
    result.results.forEach((r, i) => {
      const status = r.success ? '✅' : '❌';
      const detail = r.success ? r.action : r.error;
      console.log(`${i+1}. ${status} ${r.email}: ${detail}`);
    });
    
    console.log('🎉 All done!');
    return result;
    
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

// Run it now
createAuthUsersNow();