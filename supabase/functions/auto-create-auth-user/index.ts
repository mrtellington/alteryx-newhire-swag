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
    const body = await req.json();
    const { email, full_name, first_name, last_name } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-creating auth user for: ${email}`);

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

    // Check if user exists in database
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, first_name, last_name, auth_user_id')
      .eq('email', email)
      .single();

    if (dbError || !dbUser) {
      console.error(`Database user not found for ${email}:`, dbError);
      return new Response(
        JSON.stringify({ error: 'Database user not found', details: dbError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user already has auth_user_id, skip
    if (dbUser.auth_user_id) {
      console.log(`User ${email} already has auth account: ${dbUser.auth_user_id}`);
      return new Response(
        JSON.stringify({ 
          message: 'User already has auth account', 
          email,
          auth_user_id: dbUser.auth_user_id,
          action: 'skipped'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || dbUser.full_name || `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim(),
        invited_via: 'auto_create'
      }
    });

    let finalAuthUserId = null;
    let action = '';

    if (authError) {
      // If user already exists, find them
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        console.log(`Auth user already exists for ${email}, finding existing user`);
        
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (!listError && authUsers?.users) {
          const existingAuthUser = authUsers.users.find(au => au.email?.toLowerCase() === email.toLowerCase());
          if (existingAuthUser) {
            finalAuthUserId = existingAuthUser.id;
            action = 'linked_existing';
            console.log(`Found existing auth user for ${email}: ${finalAuthUserId}`);
          } else {
            throw new Error('Auth user exists but could not be found in list');
          }
        } else {
          throw new Error(`Failed to list auth users: ${listError?.message}`);
        }
      } else {
        throw new Error(authError.message);
      }
    } else {
      finalAuthUserId = authUser.user.id;
      action = 'created_new';
      console.log(`Created new auth user for ${email}: ${finalAuthUserId}`);
    }

    // Update database record with auth_user_id
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ auth_user_id: finalAuthUserId })
      .eq('id', dbUser.id);

    if (updateError) {
      console.error(`Failed to link auth user for ${email}:`, updateError);
      throw new Error(`Failed to link auth user: ${updateError.message}`);
    }

    console.log(`✅ Successfully processed ${email}: ${action}`);

    return new Response(
      JSON.stringify({ 
        message: 'Auth user created and linked successfully', 
        email,
        auth_user_id: finalAuthUserId,
        action
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-create-auth-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});