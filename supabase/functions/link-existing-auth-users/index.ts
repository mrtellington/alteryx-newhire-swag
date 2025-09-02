import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          auth_user_id: string | null
          invited: boolean
          order_submitted: boolean
          full_name: string | null
          first_name: string | null
          last_name: string | null
          shipping_address: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          auth_user_id?: string | null
          invited?: boolean
          order_submitted?: boolean
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          shipping_address?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          auth_user_id?: string | null
          invited?: boolean
          order_submitted?: boolean
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          shipping_address?: Record<string, any>
          created_at?: string
        }
      }
      security_events: {
        Row: {
          id: string
          event_type: string
          user_id: string | null
          user_email: string | null
          metadata: Record<string, any> | null
          severity: 'low' | 'medium' | 'high' | 'critical'
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          user_id?: string | null
          user_email?: string | null
          metadata?: Record<string, any> | null
          severity?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          user_id?: string | null
          user_email?: string | null
          metadata?: Record<string, any> | null
          severity?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
        }
      }
    }
  }
}

// Helper function to validate email domain
const isValidEmailDomain = (email: string): boolean => {
  const lowerEmail = email.toLowerCase();
  return lowerEmail.endsWith('@alteryx.com') || lowerEmail.endsWith('@whitestonebranding.com');
}

// Helper function to generate secure password
const generateSecurePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to add delay between operations
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    console.log('🚀 Enhanced auth user linking process started...');
    
    // Get request body to check for specific emails and test mode
    let specificEmails: string[] | null = null;
    let testMode = false;
    try {
      const body = await req.json();
      specificEmails = body?.emails || null;
      testMode = body?.testMode || false;
      console.log('📧 Specific emails requested:', specificEmails);
      console.log('🧪 Test mode:', testMode);
    } catch {
      console.log('📧 Processing all users without auth accounts');
    }

    // Get users who need auth accounts
    let query = supabase
      .from('users')
      .select('id, email, full_name, first_name, last_name, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null);
    
    if (specificEmails && specificEmails.length > 0) {
      query = query.in('email', specificEmails);
    }

    const { data: users, error: usersError } = await query.order('email');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: usersError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!users || users.length === 0) {
      console.log('✅ No users need auth account linking');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          successful: 0,
          errors: 0,
          message: 'No users need auth account linking',
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📊 Found ${users.length} users needing auth accounts`);
    
    // Safety check for large batches
    if (!testMode && users.length > 50) {
      console.log('🛡️  Large batch detected - use test mode for safety');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Large batch safety check - use testMode: true for batches over 50 users',
          processed: 0,
          successful: 0,
          errors: 0,
          results: []
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const results = [];
    let successful = 0;
    let errors = 0;
    const processedEmails = new Set<string>();

    // Log batch start
    await supabase.from('security_events').insert({
      event_type: testMode ? 'test_auth_linking_started' : 'batch_auth_linking_started',
      metadata: {
        user_count: users.length,
        specific_emails: specificEmails,
        test_mode: testMode,
        timestamp: new Date().toISOString()
      },
      severity: 'medium'
    });

    // Get all existing auth users once to avoid repeated API calls
    console.log('🔍 Fetching existing auth users...');
    const { data: allAuthUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error fetching auth users:', listError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch existing auth users', 
          details: listError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📊 Found ${allAuthUsers.users.length} existing auth users`);
    
    // Create a map for quick lookup
    const authUserMap = new Map();
    allAuthUsers.users.forEach(authUser => {
      if (authUser.email) {
        authUserMap.set(authUser.email.toLowerCase(), authUser);
      }
    });

    // Process users in smaller batches with enhanced error handling
    const batchSize = testMode ? 3 : 5;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${batch.length} users)`);

      for (const user of batch) {
        try {
          // Skip if we already processed this email (duplicate check)
          if (processedEmails.has(user.email.toLowerCase())) {
            console.log(`⏭️  Skipping duplicate: ${user.email}`);
            continue;
          }
          processedEmails.add(user.email.toLowerCase());

          console.log(`👤 Processing user: ${user.email} (ordered: ${user.order_submitted})`);

          // Validate email domain
          if (!isValidEmailDomain(user.email)) {
            const errorMsg = `Invalid email domain: ${user.email}`;
            console.log(`   ❌ ${errorMsg}`);
            
            results.push({
              email: user.email,
              success: false,
              action: 'validation_failed',
              error: errorMsg
            });
            errors++;
            continue;
          }

          // Check for existing auth user using our pre-fetched map
          const existingAuthUser = authUserMap.get(user.email.toLowerCase());

          let authUserId: string;
          let action: string;

          if (existingAuthUser) {
            // Link to existing auth user
            authUserId = existingAuthUser.id;
            action = 'linked_existing_auth';
            console.log(`   🔗 Found existing auth user: ${authUserId}`);
          } else {
            // Create new auth user with enhanced metadata
            const password = generateSecurePassword();
            
            console.log(`   🆕 Creating new auth user...`);
            const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
              email: user.email,
              password: password,
              email_confirm: true, // Auto-confirm email for seamless magic link experience
              user_metadata: {
                full_name: user.full_name,
                first_name: user.first_name,
                last_name: user.last_name,
                created_by: 'auth_linking_function',
                created_at: new Date().toISOString()
              }
            });

            if (createError) {
              console.log(`   ❌ Error creating auth user: ${createError.message}`);
              
              results.push({
                email: user.email,
                success: false,
                action: 'auth_creation_failed',
                error: createError.message
              });
              errors++;
              continue;
            }

            if (!newAuthUser.user) {
              console.log(`   ❌ No user returned from auth creation`);
              
              results.push({
                email: user.email,
                success: false,
                action: 'auth_creation_failed',
                error: 'No user returned from creation'
              });
              errors++;
              continue;
            }

            authUserId = newAuthUser.user.id;
            action = 'created_new_auth';
            console.log(`   ✅ Created new auth user: ${authUserId}`);
            
            // Add to our map for potential duplicates in this batch
            authUserMap.set(user.email.toLowerCase(), newAuthUser.user);
          }

          // Update user record with auth_user_id (with retry logic)
          let updateSuccess = false;
          let updateAttempts = 0;
          const maxUpdateAttempts = 3;

          while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
            updateAttempts++;
            
            const { error: updateError } = await supabase
              .from('users')
              .update({ auth_user_id: authUserId })
              .eq('id', user.id);

            if (!updateError) {
              updateSuccess = true;
            } else {
              console.log(`   ⚠️  Database update attempt ${updateAttempts} failed: ${updateError.message}`);
              
              if (updateAttempts < maxUpdateAttempts) {
                await delay(1000 * updateAttempts); // Exponential backoff
              } else {
                // Final attempt failed - cleanup if we created a new auth user
                if (action === 'created_new_auth') {
                  try {
                    await supabase.auth.admin.deleteUser(authUserId);
                    console.log(`   🧹 Cleaned up orphaned auth user: ${authUserId}`);
                  } catch (cleanupError) {
                    console.log(`   ⚠️  Failed to cleanup auth user: ${cleanupError}`);
                  }
                }
                
                results.push({
                  email: user.email,
                  success: false,
                  action: 'database_update_failed',
                  error: updateError.message,
                  attempts: updateAttempts
                });
                errors++;
                break;
              }
            }
          }

          if (!updateSuccess) {
            continue; // Skip to next user
          }

          // Log successful linking
          await supabase.from('security_events').insert({
            event_type: 'auth_user_linked',
            user_email: user.email,
            metadata: {
              auth_user_id: authUserId,
              action: action,
              user_id: user.id,
              test_mode: testMode,
              update_attempts: updateAttempts
            },
            severity: 'low'
          });

          results.push({
            email: user.email,
            success: true,
            action: action,
            auth_user_id: authUserId
          });
          successful++;
          console.log(`   ✅ Success: ${action} (attempts: ${updateAttempts})`);

          // Smaller delay between users
          await delay(testMode ? 1000 : 500);

        } catch (userError) {
          console.log(`   ❌ Unexpected error for ${user.email}:`, userError);
          
          await supabase.from('security_events').insert({
            event_type: 'auth_linking_user_error',
            user_email: user.email,
            metadata: {
              error: userError.message,
              stack: userError.stack,
              test_mode: testMode
            },
            severity: 'high'
          });
          
          results.push({
            email: user.email,
            success: false,
            action: 'unexpected_error',
            error: userError.message || 'Unknown error'
          });
          errors++;
        }
      }

      // Delay between batches (longer in test mode)
      if (i + batchSize < users.length) {
        const delayMs = testMode ? 3000 : 2000;
        console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
        await delay(delayMs);
      }
    }

    // Log batch completion
    const completionSeverity = successful === users.length ? 'low' : (errors > successful ? 'high' : 'medium');
    
    await supabase.from('security_events').insert({
      event_type: testMode ? 'test_auth_linking_completed' : 'batch_auth_linking_completed',
      metadata: {
        processed: users.length,
        successful: successful,
        errors: errors,
        success_rate: users.length > 0 ? (successful / users.length * 100).toFixed(1) : 0,
        test_mode: testMode,
        results_summary: {
          linked_existing: results.filter(r => r.action === 'linked_existing_auth').length,
          created_new: results.filter(r => r.action === 'created_new_auth').length,
          validation_failed: results.filter(r => r.action === 'validation_failed').length,
          auth_creation_failed: results.filter(r => r.action === 'auth_creation_failed').length,
          database_update_failed: results.filter(r => r.action === 'database_update_failed').length,
          unexpected_errors: results.filter(r => r.action === 'unexpected_error').length
        }
      },
      severity: completionSeverity
    });

    const successRate = users.length > 0 ? (successful / users.length * 100).toFixed(1) : 0;
    console.log(`🎉 Batch processing completed! Success: ${successful}/${users.length} (${successRate}%)`);

    if (testMode && successful === users.length) {
      console.log('🧪 TEST MODE: All users processed successfully - safe to run full batch');
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: users.length,
        successful: successful,
        errors: errors,
        success_rate: successRate,
        test_mode: testMode,
        results: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    
    // Log the function-level error
    try {
      await supabase.from('security_events').insert({
        event_type: 'auth_linking_function_error',
        metadata: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        severity: 'critical'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        success: false,
        processed: 0,
        successful: 0,
        errors: 1
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})