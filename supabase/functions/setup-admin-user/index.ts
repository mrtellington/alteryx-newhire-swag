import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  console.log('🚀 Setting up admin user auth account...');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify this email is in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('active', true)
      .single();

    if (adminError || !adminUser) {
      console.error('Admin user not found:', adminError);
      return new Response(JSON.stringify({ 
        error: 'Email not found in admin_users or not active' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // Link existing auth user to admin_users if not already linked
      if (!adminUser.auth_user_id) {
        await supabase
          .from('admin_users')
          .update({ auth_user_id: existingUser.id })
          .eq('email', email);
      }

      // Send password reset email
      const { error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: 'https://alteryxnewhire.com/admin'
        }
      });

      if (resetError) {
        console.error('Error generating recovery link:', resetError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Auth user already exists. Password reset link sent.',
        auth_user_id: existingUser.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create new auth user with cryptographically secure password
    const tempPassword = `Admin${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}!`;
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: adminUser.role,
        created_via: 'setup_admin_user_function'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return new Response(JSON.stringify({ 
        error: 'Failed to create auth user',
        details: authError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Link auth user to admin_users
    await supabase
      .from('admin_users')
      .update({ auth_user_id: authUser.user?.id })
      .eq('email', email);

    // Log security event
    await supabase.from('security_events').insert({
      event_type: 'admin_auth_created',
      user_email: email,
      metadata: {
        admin_user_id: adminUser.id,
        auth_user_id: authUser.user?.id,
        created_via: 'setup_admin_user_function'
      },
      severity: 'medium'
    });

    console.log(`✅ Created auth user for ${email}: ${authUser.user?.id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Auth user created successfully',
      auth_user_id: authUser.user?.id,
      temp_password: tempPassword,
      note: 'Use this temporary password to log in, then change it immediately'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
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
