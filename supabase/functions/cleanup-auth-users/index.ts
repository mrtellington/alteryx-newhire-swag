import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    console.log('Starting cleanup of unauthorized auth users...');
    
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    console.log(`Found ${authUsers.users.length} auth users to check`);
    
    const deletedUsers = [];
    
    for (const authUser of authUsers.users) {
      const email = authUser.email;
      if (!email) continue;
      
      console.log(`Checking authorization for: ${email}`);
      
      // Check if user is an active admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('email, active')
        .eq('email', email)
        .eq('active', true)
        .single();

      // Check if user is an invited user who hasn't ordered
      const { data: regularUser } = await supabase
        .from('users')
        .select('email, invited, order_submitted')
        .eq('email', email)
        .eq('invited', true)
        .eq('order_submitted', false)
        .single();

      const isAuthorized = !!adminUser || !!regularUser;
      
      if (!isAuthorized) {
        console.log(`DELETING unauthorized auth user: ${email}`);
        
        // Log the deletion
        await supabase.from('security_events').insert({
          event_type: 'unauthorized_auth_user_deleted',
          user_email: email,
          metadata: {
            deleted_user_id: authUser.id,
            reason: 'User not in authorized database or already ordered'
          },
          severity: 'high'
        });
        
        // Delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);
        
        if (deleteError) {
          console.error(`Error deleting user ${email}:`, deleteError);
        } else {
          console.log(`Successfully deleted unauthorized user: ${email}`);
          deletedUsers.push({ email, id: authUser.id });
        }
      } else {
        console.log(`User ${email} is authorized`);
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedUsers.length} unauthorized users.`);
    
    return new Response(JSON.stringify({
      message: 'Cleanup completed',
      deletedUsers: deletedUsers,
      totalDeleted: deletedUsers.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});