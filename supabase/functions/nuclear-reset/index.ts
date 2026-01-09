import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  // Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('Nuclear reset: Missing authentication');
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Validate user and check admin role
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: roleData, error: roleError } = await supabaseAuth.rpc('get_admin_role');
  if (roleError || roleData !== 'admin') {
    console.error('Nuclear reset: Access denied - not an admin', roleError);
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Use service role client for actual operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🚨 NUCLEAR RESET: Starting complete data wipe (authorized by admin)...');
    
    // Step 1: Delete all auth users first
    console.log('🧹 Step 1: Deleting all auth users...');
    const { data: authUsers, error: authListError } = await supabase.auth.admin.listUsers();
    
    if (authListError) {
      console.error('Error listing auth users:', authListError);
    } else {
      let deletedAuthCount = 0;
      for (const user of authUsers.users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (!deleteError) {
          deletedAuthCount++;
          console.log(`Deleted auth user: ${user.email}`);
        }
      }
      console.log(`✅ Deleted ${deletedAuthCount} auth users`);
    }

    // Step 2: Delete all orders (using service role to bypass RLS)
    console.log('🗑️ Step 2: Deleting all orders...');
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (ordersError) {
      console.error('Orders deletion error:', ordersError);
    } else {
      console.log('✅ All orders deleted');
    }

    // Step 3: Delete all users (using service role to bypass RLS)
    console.log('🗑️ Step 3: Deleting all users...');
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (usersError) {
      console.error('Users deletion error:', usersError);
      throw usersError;
    } else {
      console.log('✅ All users deleted');
    }

    // Step 4: Verify everything is gone
    const { data: remainingUsers, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    console.log(`🔍 Verification: ${count || 0} users remaining`);

    // Log the nuclear reset
    await supabase.from('security_events').insert({
      event_type: 'nuclear_reset_completed',
      metadata: {
        deleted_auth_users: authUsers?.users?.length || 0,
        remaining_users: count || 0,
        timestamp: new Date().toISOString()
      },
      severity: 'critical'
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Nuclear reset completed',
      deleted_auth_users: authUsers?.users?.length || 0,
      remaining_users: count || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
    
  } catch (error) {
    console.error('❌ Nuclear reset failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});