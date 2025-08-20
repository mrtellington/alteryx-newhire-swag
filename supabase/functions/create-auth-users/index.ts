import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role key for admin operations
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

    // Get users without auth_user_id
    const { data: usersNeedingAuth, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, first_name, last_name')
      .is('auth_user_id', null);

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const user of usersNeedingAuth || []) {
      console.log(`Creating auth user for: ${user.email}`);
      
      try {
        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            invited_via: 'admin_fix'
          }
        });

        if (authError) {
          // If user already exists, try to find them
          if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
            console.log(`Auth user already exists for ${user.email}, finding existing user`);
            
            const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (!listError && authUsers?.users) {
              const existingAuthUser = authUsers.users.find(au => au.email?.toLowerCase() === user.email.toLowerCase());
              if (existingAuthUser) {
                // Update database record with existing auth user ID
                const { error: updateError } = await supabaseAdmin
                  .from('users')
                  .update({ auth_user_id: existingAuthUser.id })
                  .eq('id', user.id);

                if (updateError) {
                  results.push({ email: user.email, success: false, error: `Failed to link existing auth user: ${updateError.message}` });
                } else {
                  results.push({ email: user.email, success: true, auth_user_id: existingAuthUser.id, action: 'linked_existing' });
                }
              } else {
                results.push({ email: user.email, success: false, error: 'Auth user exists but could not be found in list' });
              }
            } else {
              results.push({ email: user.email, success: false, error: `Failed to list auth users: ${listError?.message}` });
            }
          } else {
            results.push({ email: user.email, success: false, error: authError.message });
          }
        } else {
          // Update the user record with auth_user_id
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ auth_user_id: authUser.user.id })
            .eq('id', user.id);

          if (updateError) {
            results.push({ email: user.email, success: false, error: `Auth user created but failed to link: ${updateError.message}` });
          } else {
            results.push({ email: user.email, success: true, auth_user_id: authUser.user.id, action: 'created_new' });
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError);
        results.push({ email: user.email, success: false, error: userError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Auth user creation completed', 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-auth-users function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});