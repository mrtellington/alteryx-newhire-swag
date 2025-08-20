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
      .select('id, email, full_name')
      .is('auth_user_id', null)
      .in('email', ['christian.houston@whitestonebranding.com', 'tejal.makuck@whitestonebranding.com']);

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const user of usersNeedingAuth || []) {
      console.log(`Creating auth user for: ${user.email}`);
      
      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          invited_via: 'import_fix'
        }
      });

      if (authError) {
        console.error(`Failed to create auth user for ${user.email}:`, authError);
        results.push({ email: user.email, success: false, error: authError.message });
        continue;
      }

      // Update the user record with auth_user_id
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ auth_user_id: authUser.user.id })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Failed to update user record for ${user.email}:`, updateError);
        results.push({ email: user.email, success: false, error: updateError.message });
      } else {
        console.log(`Successfully linked auth user for ${user.email}`);
        results.push({ email: user.email, success: true, auth_user_id: authUser.user.id });
      }
    }

    return new Response(
      JSON.stringify({ message: 'User auth setup completed', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fix-imported-users function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});