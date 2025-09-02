import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          auth_user_id: string | null;
          invited: boolean;
          order_submitted: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string;
          auth_user_id?: string | null;
          invited?: boolean;
          order_submitted?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          auth_user_id?: string | null;
          invited?: boolean;
          order_submitted?: boolean;
        };
      };
      security_events: {
        Row: {
          id: string;
          event_type: string;
          user_email: string | null;
          metadata: any;
          severity: string;
          created_at: string;
        };
        Insert: {
          event_type: string;
          user_email?: string | null;
          metadata?: any;
          severity?: string;
          created_at?: string;
        };
      };
    };
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Starting enhanced fix-missing-auth-users function...');

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔍 Fetching users who need auth accounts...');

    // Get all users who need auth accounts
    const { data: usersNeedingAuth, error: fetchError } = await supabase
      .from('users')
      .select('id, email, full_name, auth_user_id, invited, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null);

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${usersNeedingAuth?.length || 0} users needing auth accounts`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 10; // Process in smaller batches
    const DELAY_BETWEEN_USERS = 200; // Longer delay between users
    const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
    const MAX_RETRIES = 3;

    // Process users in batches
    if (usersNeedingAuth && usersNeedingAuth.length > 0) {
      for (let i = 0; i < usersNeedingAuth.length; i += BATCH_SIZE) {
        const batch = usersNeedingAuth.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(usersNeedingAuth.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);

        // Process each user in the current batch
        for (const user of batch) {
          let retryCount = 0;
          let userSuccess = false;

          while (retryCount < MAX_RETRIES && !userSuccess) {
            try {
              const attemptSuffix = retryCount > 0 ? ` (attempt ${retryCount + 1})` : '';
              console.log(`👤 Processing user: ${user.email}${attemptSuffix}`);

              // Generate a secure temporary password
              const tempPassword = 'temp_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

              // Create auth user using admin API with enhanced error handling
              const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: tempPassword,
                email_confirm: true, // Auto-confirm email
                user_metadata: {
                  full_name: user.full_name || user.email.split('@')[0],
                  source: 'batch_auth_creation'
                }
              });

              if (createError) {
                // Check if it's a rate limit or temporary error
                if (createError.message.includes('rate') || 
                    createError.message.includes('limit') ||
                    createError.message.includes('timeout')) {
                  retryCount++;
                  if (retryCount < MAX_RETRIES) {
                    const backoffDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff
                    console.log(`⏳ Rate limit detected for ${user.email}, retrying in ${backoffDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    continue;
                  }
                }

                console.error(`❌ Failed to create auth user for ${user.email}:`, createError);
                results.push({
                  email: user.email,
                  success: false,
                  error: createError.message,
                  action: 'create_auth_failed',
                  retries: retryCount
                });
                errorCount++;
                break;
              }

              console.log(`✅ Created auth user for ${user.email}: ${authUser.user?.id}`);

              // Update the users table with the new auth_user_id
              const { error: updateError } = await supabase
                .from('users')
                .update({ auth_user_id: authUser.user!.id })
                .eq('id', user.id);

              if (updateError) {
                console.error(`❌ Failed to update user record for ${user.email}:`, updateError);
                
                // If update fails, we should clean up the auth user to avoid orphaned accounts
                try {
                  await supabase.auth.admin.deleteUser(authUser.user!.id);
                  console.log(`🧹 Cleaned up orphaned auth user for ${user.email}`);
                } catch (cleanupError) {
                  console.error(`❌ Failed to clean up auth user for ${user.email}:`, cleanupError);
                }

                retryCount++;
                if (retryCount < MAX_RETRIES) {
                  console.log(`🔄 Retrying user record update for ${user.email}...`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  continue;
                }

                results.push({
                  email: user.email,
                  success: false,
                  error: updateError.message,
                  action: 'update_user_failed',
                  auth_user_id: authUser.user?.id,
                  retries: retryCount
                });
                errorCount++;
                break;
              }

              // Log security event
              await supabase
                .from('security_events')
                .insert({
                  event_type: 'auth_user_created_via_enhanced_fix',
                  user_email: user.email,
                  metadata: {
                    user_id: user.id,
                    auth_user_id: authUser.user!.id,
                    previously_missing: true,
                    had_order: user.order_submitted,
                    batch_number: batchNumber,
                    retry_count: retryCount
                  },
                  severity: 'medium'
                });

              results.push({
                email: user.email,
                success: true,
                action: 'auth_user_created_and_linked',
                auth_user_id: authUser.user!.id,
                retries: retryCount
              });

              successCount++;
              userSuccess = true;
              console.log(`🎉 Successfully processed ${user.email}`);

            } catch (userError) {
              console.error(`❌ Exception processing user ${user.email}:`, userError);
              retryCount++;
              
              if (retryCount < MAX_RETRIES) {
                console.log(`🔄 Retrying due to exception for ${user.email}...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                continue;
              }

              results.push({
                email: user.email,
                success: false,
                error: userError.message,
                action: 'exception_occurred',
                retries: retryCount
              });
              errorCount++;
              break;
            }
          }

          // Delay between users to avoid overwhelming the auth service
          if (!userSuccess) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_USERS));
          }
        }

        // Longer delay between batches
        if (i + BATCH_SIZE < usersNeedingAuth.length) {
          console.log(`⏸️  Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
    }

    // Log completion
    await supabase
      .from('security_events')
      .insert({
        event_type: 'batch_auth_fix_completed',
        metadata: {
          total_processed: usersNeedingAuth?.length || 0,
          successful: successCount,
          errors: errorCount,
          timestamp: new Date().toISOString()
        },
        severity: 'medium'
      });

    console.log(`🏁 Batch processing completed: ${successCount} successful, ${errorCount} errors`);

    const response = {
      success: true,
      processed: usersNeedingAuth?.length || 0,
      successful: successCount,
      errors: errorCount,
      results: results
    };

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Check function logs for more information'
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500,
      }
    );
  }
});