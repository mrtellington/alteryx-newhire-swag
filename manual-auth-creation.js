// Manual auth creation for remaining users
const SUPABASE_URL = "https://emnemfewmpjczkgwzrjv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA";

const remainingUsers = [
  'alfiya.s@alteryx.com',
  'amit.mittal@alteryx.com',
  'daniel.spur@alteryx.com',
  'jon.simmonds@alteryx.com',
  'lukas.horak@alteryx.com',
  'rasim.muftiev@alteryx.com',
  'rubaina.parveen@alteryx.com',
  'sanzhar.marat@alteryx.com',
  'saranya.prakasam@alteryx.com',
  'shayan.ansari@alteryx.com',
  'sourabh.rakhya@alteryx.com'
];

const processUser = async (email) => {
  try {
    console.log(`Processing ${email}...`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-auth-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ single_email: email })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`${email}: ${result.results?.[0]?.success ? '✅' : '❌'} ${result.results?.[0]?.action || result.results?.[0]?.error || 'No details'}`);
    
    if (result.results?.[0]?.auth_user_id) {
      console.log(`   🔑 Auth ID: ${result.results[0].auth_user_id}`);
    }
    
    return result;
  } catch (error) {
    console.error(`${email}: ❌ Error:`, error.message);
    return { error: error.message };
  }
};

const processAllUsers = async () => {
  console.log('🚀 Processing 11 remaining users individually...\n');
  
  for (const email of remainingUsers) {
    await processUser(email);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n🎉 All users processed! Check database to verify all 32 users now have auth accounts.');
  
  // Verify final count
  setTimeout(async () => {
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=email,auth_user_id&invited=eq.true&auth_user_id=is.null`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    const remaining = await verifyResponse.json();
    console.log(`\n📊 Verification: ${remaining.length} users still without auth accounts`);
    if (remaining.length > 0) {
      console.log('Still missing:', remaining.map(u => u.email));
    } else {
      console.log('🎉 SUCCESS! All 32 users now have auth accounts and can login and order!');
    }
  }, 2000);
};

processAllUsers();