import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.71.1'

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
          full_name: string
          auth_user_id: string | null
          invited: boolean
          order_submitted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          auth_user_id?: string | null
          invited?: boolean
          order_submitted?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          auth_user_id?: string | null
          invited?: boolean
          order_submitted?: boolean
          created_at?: string
        }
      }
      security_events: {
        Row: {
          id: string
          event_type: string
          user_email: string | null
          metadata: any
          severity: string
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          user_email?: string | null
          metadata?: any
          severity?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          user_email?: string | null
          metadata?: any
          severity?: string
          created_at?: string
        }
      }
    }
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔍 Starting auth user linking process...');

    // Get request body to check if we're processing specific users
    const body = await req.json().catch(() => ({}));
    const targetEmails = body.emails || [];
    
    // Get users without auth_user_id
    let query = supabase
      .from('users')
      .select('id, email, full_name, auth_user_id, invited, order_submitted')
      .eq('invited', true)
      .is('auth_user_id', null);
    
    if (targetEmails.length > 0) {
      query = query.in('email', targetEmails);
    }
    
    const { data: usersWithoutAuth, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${usersWithoutAuth?.length || 0} users without auth accounts`);

    if (!usersWithoutAuth || usersWithoutAuth.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          successful: 0,
          errors: 0,
          results: [],
          message: 'No users need auth linking'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];
    let successfulLinks = 0;
    let errors = 0;

    // Process users in batches to avoid rate limits
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < usersWithoutAuth.length; i += batchSize) {
      batches.push(usersWithoutAuth.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users)`);
      
      for (const user of batch) {
        console.log(`👤 Processing user: ${user.email}`);
        
        try {
          // First, try to find existing auth user by email
          const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
          
          if (listError) {
            console.error(`❌ Error listing auth users: ${listError.message}`);
            results.push({
              email: user.email,
              success: false,
              error: `Failed to list auth users: ${listError.message}`,
              action: 'list_auth_users_failed'
            });
            errors++;
            continue;
          }

          // Find matching auth user by email
          const existingAuthUser = authUsers.users?.find(authUser => 
            authUser.email?.toLowerCase() === user.email.toLowerCase()
          );

          if (existingAuthUser) {
            console.log(`✅ Found existing auth user for ${user.email}, linking...`);
            
            // Link the existing auth user to the database user
            const { error: updateError } = await supabase
              .from('users')
              .update({ auth_user_id: existingAuthUser.id })
              .eq('id', user.id);

            if (updateError) {
              console.error(`❌ Failed to link auth user for ${user.email}:`, updateError);
              results.push({
                email: user.email,
                success: false,
                error: `Failed to update user record: ${updateError.message}`,
                action: 'link_failed',
                auth_user_id: existingAuthUser.id
              });
              errors++;
            } else {
              console.log(`✅ Successfully linked auth user for ${user.email}`);
              results.push({
                email: user.email,
                success: true,
                action: 'linked_existing_auth_user',
                auth_user_id: existingAuthUser.id
              });
              successfulLinks++;

              // Log security event
              await supabase.from('security_events').insert({
                event_type: 'auth_user_linked',
                user_email: user.email,
                metadata: {
                  user_id: user.id,
                  auth_user_id: existingAuthUser.id,
                  action: 'linked_existing'
                },
                severity: 'low'
              });
            }
          } else {
            console.log(`⚠️ No existing auth user found for ${user.email}, creating new one...`);
            
            // Create new auth user since none exists
            const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
              email: user.email,
              email_confirm: true,
              user_metadata: {
                full_name: user.full_name,
                invited: true
              }
            });

            if (createError) {
              console.error(`❌ Failed to create auth user for ${user.email}:`, createError);
              results.push({
                email: user.email,
                success: false,
                error: createError.message,
                action: 'create_auth_user_failed'
              });
              errors++;
            } else if (newAuthUser.user) {
              console.log(`✅ Created new auth user for ${user.email}, linking...`);
              
              // Link the new auth user to the database user
              const { error: updateError } = await supabase
                .from('users')
                .update({ auth_user_id: newAuthUser.user.id })
                .eq('id', user.id);

              if (updateError) {
                console.error(`❌ Failed to link new auth user for ${user.email}:`, updateError);
                
                // Clean up the auth user we just created since linking failed
                await supabase.auth.admin.deleteUser(newAuthUser.user.id);
                
                results.push({
                  email: user.email,
                  success: false,
                  error: `Failed to link new auth user: ${updateError.message}`,
                  action: 'create_and_link_failed'
                });
                errors++;
              } else {
                console.log(`✅ Successfully created and linked auth user for ${user.email}`);
                results.push({
                  email: user.email,
                  success: true,
                  action: 'created_and_linked_new_auth_user',
                  auth_user_id: newAuthUser.user.id
                });
                successfulLinks++;

                // Log security event
                await supabase.from('security_events').insert({
                  event_type: 'auth_user_created_and_linked',
                  user_email: user.email,
                  metadata: {
                    user_id: user.id,
                    auth_user_id: newAuthUser.user.id,
                    action: 'created_and_linked'
                  },
                  severity: 'low'
                });
              }
            }
          }

          // Small delay between individual users
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Unexpected error processing ${user.email}:`, error);
          results.push({
            email: user.email,
            success: false,
            error: error.message || 'Unexpected error',
            action: 'unexpected_error'
          });
          errors++;
        }
      }

      // Delay between batches
      if (batchIndex < batches.length - 1) {
        console.log('⏸️ Waiting 1000ms before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🏁 Linking process completed: ${successfulLinks} successful, ${errors} errors`);

    // Log completion event
    await supabase.from('security_events').insert({
      event_type: 'auth_linking_batch_completed',
      metadata: {
        processed: usersWithoutAuth.length,
        successful: successfulLinks,
        errors: errors,
        target_emails: targetEmails
      },
      severity: 'medium'
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: usersWithoutAuth.length,
        successful: successfulLinks,
        errors: errors,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in auth linking function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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
});