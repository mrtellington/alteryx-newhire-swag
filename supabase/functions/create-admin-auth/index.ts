import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string;
          email: string;
          user_id: string | null;
          created_at: string;
          created_by: string | null;
          active: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          user_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          active?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          user_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          active?: boolean;
        };
      };
      security_events: {
        Row: {
          id: string;
          event_type: string;
          user_id: string | null;
          user_email: string | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: any;
          severity: 'low' | 'medium' | 'high' | 'critical';
          session_id: string | null;
          additional_context: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string | null;
          user_email?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: any;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          session_id?: string | null;
          additional_context?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          user_id?: string | null;
          user_email?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: any;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          session_id?: string | null;
          additional_context?: any;
          created_at?: string;
        };
      };
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log('🚀 Starting admin auth creation process...');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ Supabase client initialized');

    // Get admin users from database
    const { data: adminUsers, error: fetchError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('active', true)
      .is('user_id', null);

    if (fetchError) {
      console.error('❌ Error fetching admin users:', fetchError);
      throw fetchError;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log('✅ No admin users need auth account creation');
      return new Response(JSON.stringify({
        message: 'No admin users need auth account creation',
        processed: 0,
        results: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${adminUsers.length} admin users needing auth accounts`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each admin user
    for (const adminUser of adminUsers) {
      console.log(`🔄 Processing admin user: ${adminUser.email}`);
      
      try {
        // Generate a secure temporary password for admin users
        const tempPassword = `Admin${Math.random().toString(36).slice(2)}!${Date.now()}`;
        
        // Create auth user with admin email
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: adminUser.email,
          password: tempPassword,
          email_confirm: true, // Skip email confirmation for admin users
          user_metadata: {
            role: 'admin',
            created_via: 'admin_creation_function'
          }
        });

        if (authError) {
          console.error(`❌ Failed to create auth for ${adminUser.email}:`, authError);
          results.push({
            email: adminUser.email,
            success: false,
            error: authError.message
          });
          failureCount++;
          continue;
        }

        console.log(`✅ Created auth user for ${adminUser.email}: ${authUser.user?.id}`);

        // Update admin_users table with the auth user ID
        const { error: updateError } = await supabase
          .from('admin_users')
          .update({ user_id: authUser.user?.id })
          .eq('email', adminUser.email);

        if (updateError) {
          console.error(`❌ Failed to update admin_users for ${adminUser.email}:`, updateError);
          
          // Clean up: delete the created auth user if we can't link it
          try {
            await supabase.auth.admin.deleteUser(authUser.user!.id);
            console.log(`🧹 Cleaned up auth user for ${adminUser.email}`);
          } catch (cleanupError) {
            console.error(`❌ Failed to cleanup auth user for ${adminUser.email}:`, cleanupError);
          }

          results.push({
            email: adminUser.email,
            success: false,
            error: `Failed to link auth user: ${updateError.message}`
          });
          failureCount++;
          continue;
        }

        // Log security event
        await supabase.from('security_events').insert({
          event_type: 'admin_auth_created',
          user_email: adminUser.email,
          metadata: {
            admin_user_id: adminUser.id,
            auth_user_id: authUser.user?.id,
            created_via: 'admin_creation_function'
          },
          severity: 'medium'
        });

        results.push({
          email: adminUser.email,
          success: true,
          auth_user_id: authUser.user?.id,
          temp_password: tempPassword
        });
        successCount++;
        
        console.log(`✅ Successfully processed ${adminUser.email}`);

        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Exception processing ${adminUser.email}:`, error);
        results.push({
          email: adminUser.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failureCount++;
      }
    }

    // Log summary
    await supabase.from('security_events').insert({
      event_type: 'admin_auth_creation_summary',
      metadata: {
        total_processed: adminUsers.length,
        successful: successCount,
        failed: failureCount,
        results: results
      },
      severity: 'low'
    });

    console.log(`🎉 Admin auth creation completed: ${successCount} successful, ${failureCount} failed`);

    return new Response(JSON.stringify({
      message: 'Admin auth creation completed',
      processed: adminUsers.length,
      successful: successCount,
      failed: failureCount,
      results: results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in admin auth creation function:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);