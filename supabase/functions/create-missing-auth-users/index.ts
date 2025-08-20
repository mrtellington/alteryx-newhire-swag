import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAuthUserResult {
  email: string;
  success: boolean;
  auth_user_id?: string;
  error?: string;
  action: 'created' | 'linked' | 'failed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔧 Starting auth user creation for missing users...');

    // Get all users without auth_user_id
    const { data: usersWithoutAuth, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, first_name, last_name')
      .is('auth_user_id', null)
      .eq('invited', true);

    if (queryError) {
      console.error('❌ Error querying users:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query users', details: queryError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!usersWithoutAuth || usersWithoutAuth.length === 0) {
      console.log('✅ No users need auth account creation');
      return new Response(
        JSON.stringify({ 
          message: 'All users already have auth accounts', 
          processed: 0,
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${usersWithoutAuth.length} users without auth accounts`);
    
    const results: CreateAuthUserResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process users in batches of 5 with progressive delays
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < usersWithoutAuth.length; i += batchSize) {
      batches.push(usersWithoutAuth.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users)`);
      
      for (let userIndex = 0; userIndex < batch.length; userIndex++) {
        const user = batch[userIndex];
        const delay = Math.min(1000 + (batchIndex * 500) + (userIndex * 200), 3000);
        
        if (userIndex > 0 || batchIndex > 0) {
          console.log(`⏳ Waiting ${delay}ms before processing ${user.email}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
          console.log(`👤 Creating auth user for: ${user.email}`);
          
          // First, check if auth user already exists
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers.users?.find(authUser => 
            authUser.email?.toLowerCase() === user.email.toLowerCase()
          );

          let authUserId: string;
          let action: 'created' | 'linked' = 'created';

          if (existingUser) {
            console.log(`🔗 Found existing auth user for ${user.email}, linking...`);
            authUserId = existingUser.id;
            action = 'linked';
          } else {
            // Create new auth user with retry logic
            let retryCount = 0;
            const maxRetries = 3;
            let authResult;

            while (retryCount < maxRetries) {
              try {
                authResult = await supabaseAdmin.auth.admin.createUser({
                  email: user.email,
                  email_confirm: true,
                  user_metadata: {
                    full_name: user.full_name,
                    first_name: user.first_name,
                    last_name: user.last_name
                  }
                });

                if (authResult.error) {
                  if (authResult.error.message.includes('rate limit') && retryCount < maxRetries - 1) {
                    retryCount++;
                    const retryDelay = 2000 * Math.pow(2, retryCount);
                    console.log(`⚠️ Rate limited, retrying in ${retryDelay}ms... (attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                  }
                  throw authResult.error;
                }
                break;
              } catch (error) {
                if (retryCount === maxRetries - 1) {
                  throw error;
                }
                retryCount++;
              }
            }

            if (!authResult?.data?.user) {
              throw new Error('Failed to create auth user - no user returned');
            }

            authUserId = authResult.data.user.id;
            console.log(`✅ Created auth user with ID: ${authUserId}`);
          }

          // Update the users table with the auth_user_id
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ auth_user_id: authUserId })
            .eq('id', user.id);

          if (updateError) {
            console.error(`❌ Failed to update user ${user.email} with auth_user_id:`, updateError);
            throw updateError;
          }

          console.log(`✅ Successfully ${action} auth account for ${user.email}`);
          
          results.push({
            email: user.email,
            success: true,
            auth_user_id: authUserId,
            action
          });
          
          successCount++;

          // Log success to security events
          await supabaseAdmin
            .from('security_events')
            .insert({
              event_type: 'auth_user_created_missing',
              user_email: user.email,
              metadata: {
                auth_user_id: authUserId,
                action,
                batch_index: batchIndex,
                user_index: userIndex
              },
              severity: 'medium'
            });

        } catch (error) {
          console.error(`❌ Failed to create auth user for ${user.email}:`, error);
          
          results.push({
            email: user.email,
            success: false,
            error: error.message,
            action: 'failed'
          });
          
          errorCount++;

          // Log error to security events
          await supabaseAdmin
            .from('security_events')
            .insert({
              event_type: 'auth_user_creation_failed',
              user_email: user.email,
              metadata: {
                error: error.message,
                batch_index: batchIndex,
                user_index: userIndex
              },
              severity: 'high'
            });
        }
      }

      // Longer delay between batches
      if (batchIndex < batches.length - 1) {
        const batchDelay = 2000 + (batchIndex * 500);
        console.log(`⏸️ Batch complete. Waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    console.log(`🎉 Auth user creation complete! Success: ${successCount}, Errors: ${errorCount}`);

    // Log completion summary
    await supabaseAdmin
      .from('security_events')
      .insert({
        event_type: 'bulk_auth_user_creation_complete',
        metadata: {
          total_processed: usersWithoutAuth.length,
          success_count: successCount,
          error_count: errorCount,
          batches_processed: batches.length
        },
        severity: 'low'
      });

    return new Response(
      JSON.stringify({
        message: 'Auth user creation completed',
        processed: usersWithoutAuth.length,
        success_count: successCount,
        error_count: errorCount,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Critical error in auth user creation:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Critical error during auth user creation', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});