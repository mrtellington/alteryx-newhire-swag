// Force create auth users for the remaining 11 users
const SUPABASE_URL = "https://emnemfewmpjczkgwzrjv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5XX0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA";

console.log('🚀 Force creating auth users for remaining 11 users...');

fetch(`${SUPABASE_URL}/functions/v1/create-auth-users`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY
  },
  body: JSON.stringify({})
})
.then(response => response.json())
.then(result => {
  console.log('✅ Result:', result);
  console.log(`📊 Processed: ${result.processed} users`);
  
  if (result.results) {
    result.results.forEach((r, i) => {
      const status = r.success ? '✅' : '❌';
      const detail = r.success ? r.action : r.error;
      console.log(`${i+1}. ${status} ${r.email}: ${detail}`);
      if (r.auth_user_id) {
        console.log(`   🔑 Auth ID: ${r.auth_user_id}`);
      }
    });
  }
  
  console.log('\n🎉 Process completed! All 32 users should now be ready to login and order.');
})
.catch(error => {
  console.error('❌ Error:', error);
});