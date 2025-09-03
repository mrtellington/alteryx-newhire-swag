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
    console.log("=== COMPREHENSIVE ADMIN LOGIN FIX ===");
    
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const targetEmail = 'lmisenhimer@alteryx.com';
    const newPassword = 'AdminPass123!';

    // Step 1: List all users and find our target
    console.log("Step 1: Checking existing auth users...");
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to list users", details: listError }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const existingUser = users.users.find(user => user.email === targetEmail);
    
    if (existingUser) {
      console.log(`Found existing user: ${existingUser.id}`);
      console.log(`Email confirmed: ${existingUser.email_confirmed_at ? 'Yes' : 'No'}`);
      
      // Step 2: Update the existing user's password and confirm email
      console.log("Step 2: Updating existing user password...");
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: newPassword,
          email_confirm: true
        }
      );
      
      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password", details: updateError }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      console.log("Password updated successfully!");
      
      // Step 3: Update admin_users table with the auth_user_id
      console.log("Step 3: Linking to admin_users table...");
      const { error: linkError } = await supabase
        .from('admin_users')
        .update({ auth_user_id: existingUser.id })
        .eq('email', targetEmail);
      
      if (linkError) {
        console.error("Error linking admin user:", linkError);
      } else {
        console.log("Admin user linked successfully!");
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Password updated for existing user`,
          email: targetEmail,
          password: newPassword,
          auth_user_id: existingUser.id,
          action: "updated_existing"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
      
    } else {
      console.log("No existing user found, creating new auth user...");
      
      // Step 4: Create new auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: targetEmail,
        password: newPassword,
        email_confirm: true
      });
      
      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user", details: createError }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      console.log(`Created new user: ${newUser.user.id}`);
      
      // Step 5: Link to admin_users table
      const { error: linkError } = await supabase
        .from('admin_users')
        .update({ auth_user_id: newUser.user.id })
        .eq('email', targetEmail);
      
      if (linkError) {
        console.error("Error linking admin user:", linkError);
      } else {
        console.log("Admin user linked successfully!");
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `New auth user created`,
          email: targetEmail,
          password: newPassword,
          auth_user_id: newUser.user.id,
          action: "created_new"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);