// Manual creation of auth users using direct API calls
const SUPABASE_URL = "https://emnemfewmpjczkgwzrjv.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA1MzA5MiwiZXhwIjoyMDcwNjI5MDkyfQ.Qr4UpZ-bKxFnKYviFQsG4vNxAuCEHaB4uRU9jEkXCyY";

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

async function createAuthUser(email) {
  console.log(`\n🔥 Creating auth user for: ${email}`);
  
  try {
    // Step 1: Check if user exists in database
    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,full_name,first_name,last_name&email=eq.${email}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    
    const dbUsers = await dbResponse.json();
    if (!dbUsers || dbUsers.length === 0) {
      console.log(`❌ ${email}: No database record found`);
      return;
    }
    
    const dbUser = dbUsers[0];
    console.log(`✅ ${email}: Found database record`);
    
    // Step 2: Create Supabase auth user
    const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        email: email,
        email_confirm: true,
        user_metadata: {
          full_name: dbUser.full_name || `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim(),
          invited_via: 'manual_fix'
        }
      })
    });
    
    const createResult = await createResponse.json();
    
    if (!createResponse.ok) {
      if (createResult.msg?.includes('already registered') || createResult.msg?.includes('already exists')) {
        console.log(`⚠️ ${email}: Auth user already exists, finding existing user...`);
        
        // Find existing auth user
        const listResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          }
        });
        
        const { users } = await listResponse.json();
        const existingAuthUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (existingAuthUser) {
          console.log(`✅ ${email}: Found existing auth user ID: ${existingAuthUser.id}`);
          
          // Link to database record
          const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${dbUser.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY
            },
            body: JSON.stringify({ auth_user_id: existingAuthUser.id })
          });
          
          if (updateResponse.ok) {
            console.log(`🎉 ${email}: Successfully linked existing auth user!`);
          } else {
            const updateError = await updateResponse.json();
            console.log(`❌ ${email}: Failed to link existing user:`, updateError);
          }
        } else {
          console.log(`❌ ${email}: Auth user exists but not found in list`);
        }
      } else {
        console.log(`❌ ${email}: Failed to create auth user:`, createResult);
      }
    } else {
      const newAuthUser = createResult;
      console.log(`✅ ${email}: Created new auth user ID: ${newAuthUser.id}`);
      
      // Link to database record
      const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${dbUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({ auth_user_id: newAuthUser.id })
      });
      
      if (updateResponse.ok) {
        console.log(`🎉 ${email}: Successfully linked new auth user!`);
      } else {
        const updateError = await updateResponse.json();
        console.log(`❌ ${email}: Failed to link new user:`, updateError);
      }
    }
    
  } catch (error) {
    console.log(`❌ ${email}: Exception:`, error.message);
  }
}

async function processAllUsers() {
  console.log('🚀 Starting manual auth user creation for 11 users...\n');
  
  for (let i = 0; i < remainingUsers.length; i++) {
    const email = remainingUsers[i];
    console.log(`\n[${i + 1}/11] Processing: ${email}`);
    await createAuthUser(email);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 Manual process completed!');
  
  // Final verification
  setTimeout(async () => {
    console.log('\n🔍 Final verification...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=email,auth_user_id&invited=eq.true&auth_user_id=is.null`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    
    const remaining = await verifyResponse.json();
    console.log(`\n📊 FINAL RESULT: ${remaining.length} users still without auth accounts`);
    
    if (remaining.length === 0) {
      console.log('🎉🎉🎉 SUCCESS! All 32 users now have auth accounts and can login and order! 🎉🎉🎉');
    } else {
      console.log('❌ Still missing:', remaining.map(u => u.email));
    }
  }, 3000);
}

processAllUsers();