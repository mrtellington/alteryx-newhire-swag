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
    console.log("Force updating password for lmisenhimer@alteryx.com");
    
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Try a simple password first
    const { error: updateError1 } = await supabase.auth.admin.updateUserById(
      '675c1903-f935-40c3-9183-ba96b8f9bb33', // lmisenhimer@alteryx.com auth_user_id
      {
        password: 'password123',
        email_confirm: true
      }
    );

    if (updateError1) {
      console.error("Error updating to simple password:", updateError1);
    } else {
      console.log("Updated to simple password successfully");
    }

    // Now try the desired password
    const { error: updateError2 } = await supabase.auth.admin.updateUserById(
      '675c1903-f935-40c3-9183-ba96b8f9bb33',
      {
        password: '@l+eryxNH9!',
        email_confirm: true
      }
    );

    if (updateError2) {
      console.error("Error updating to desired password:", updateError2);
      // If complex password fails, stick with simple one
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Password updated to 'password123' (complex password failed)",
          password: 'password123'
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Password updated successfully to desired password");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password updated to @l+eryxNH9!",
        password: '@l+eryxNH9!'
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in force-password-update function:", error);
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