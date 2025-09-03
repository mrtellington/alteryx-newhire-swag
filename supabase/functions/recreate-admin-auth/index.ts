import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    console.log(`Recreating auth user for: ${email}`);
    
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find existing auth user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to list users", details: listError }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const existingUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      console.log(`Found existing user ${email} with ID: ${existingUser.id}`);
      
      // Delete the existing auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
      
      if (deleteError) {
        console.error("Error deleting existing user:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete existing user", details: deleteError }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      
      console.log(`Deleted existing user ${email}`);
    }

    // Create new auth user with password
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: '@l+eryxNH9!',
      email_confirm: true
    });

    if (createError) {
      console.error("Error creating new user:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create new user", details: createError }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Created new user ${email} with ID: ${newUser.user.id}`);

    // Update the admin_users table with the new auth_user_id
    const { error: updateAdminError } = await supabase
      .from('admin_users')
      .update({ auth_user_id: newUser.user.id })
      .eq('email', email);

    if (updateAdminError) {
      console.error("Error updating admin_users:", updateAdminError);
      return new Response(
        JSON.stringify({ error: "Failed to update admin_users", details: updateAdminError }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Updated admin_users table for ${email}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully recreated auth user for ${email}`,
        newUserId: newUser.user.id,
        password: '@l+eryxNH9!'
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in recreate-admin-auth function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);