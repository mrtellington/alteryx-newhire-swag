// Test creating a single user to debug the issue
const SUPABASE_URL = "https://emnemfewmpjczkgwzrjv.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA1MzA5MiwiZXhwIjoyMDcwNjI5MDkyfQ.Qr4UpZ-bKxFnKYviFQsG4vNxAuCEHaB4uRU9jEkXCyY";

async function createSingleUser() {
  console.log('🚀 Testing single user creation: alfiya.s@alteryx.com');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-auth-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ single_email: 'alfiya.s@alteryx.com' })
    });

    console.log(`📡 Response status: ${response.status}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`📡 Raw response: ${responseText}`);
    
    try {
      const result = JSON.parse(responseText);
      console.log('✅ Parsed result:', result);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
    }

  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

createSingleUser();