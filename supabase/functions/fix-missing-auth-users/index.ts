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

  console.log('🚀 Starting fix-missing-auth-users function...');

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

    // Process each user
    if (usersNeedingAuth && usersNeedingAuth.length > 0) {
      for (const user of usersNeedingAuth) {
        try {
          console.log(`👤 Processing user: ${user.email}`);

          // Generate a temporary password
          const tempPassword = 'temp_' + crypto.randomUUID().replace(/-/g, '');

          // Create auth user using admin API
          const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: tempPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              full_name: user.full_name || user.email.split('@')[0]
            }
          });

          if (createError) {
            console.error(`❌ Failed to create auth user for ${user.email}:`, createError);
            results.push({
              email: user.email,
              success: false,
              error: createError.message,
              action: 'create_auth_failed'
            });
            errorCount++;
            continue;
          }

          console.log(`✅ Created auth user for ${user.email}: ${authUser.user?.id}`);

          // Update the users table with the new auth_user_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ auth_user_id: authUser.user!.id })
            .eq('id', user.id);

          if (updateError) {
            console.error(`❌ Failed to update user record for ${user.email}:`, updateError);
            results.push({
              email: user.email,
              success: false,
              error: updateError.message,
              action: 'update_user_failed',
              auth_user_id: authUser.user?.id
            });
            errorCount++;
            continue;
          }

          // Log security event
          await supabase
            .from('security_events')
            .insert({
              event_type: 'auth_user_created_via_fix',
              user_email: user.email,
              metadata: {
                user_id: user.id,
                auth_user_id: authUser.user!.id,
                previously_missing: true,
                had_order: user.order_submitted
              },
              severity: 'medium'
            });

          results.push({
            email: user.email,
            success: true,
            action: 'auth_user_created_and_linked',
            auth_user_id: authUser.user!.id
          });

          successCount++;
          console.log(`🎉 Successfully processed ${user.email}`);

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (userError) {
          console.error(`❌ Exception processing user ${user.email}:`, userError);
          results.push({
            email: user.email,
            success: false,
            error: userError.message,
            action: 'exception_occurred'
          });
          errorCount++;
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