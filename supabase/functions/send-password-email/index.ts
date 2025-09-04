import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPasswordEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { email }: SendPasswordEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First, check if user exists in our users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, auth_user_id, first_name')
      .eq('email', email.toLowerCase())
      .eq('invited', true)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user from users table:", userError);
      return new Response(
        JSON.stringify({ error: "User not found or not invited" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // If user doesn't have auth_user_id, we need to create one first
    if (!userData.auth_user_id) {
      console.error("User has no auth_user_id, cannot send password email");
      return new Response(
        JSON.stringify({ error: "User authentication not set up" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find the auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userData.auth_user_id);
    
    if (authError || !authUser.user) {
      console.error("Error fetching auth user:", authError);
      return new Response(
        JSON.stringify({ error: "Authentication user not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate a temporary password and reset it
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    
    const { error: updateError } = await supabase.auth.admin.updateUserById(userData.auth_user_id, {
      password: tempPassword
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to generate temporary password" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get the first name or use a fallback
    const firstName = userData.first_name || "there";

    // Send email with the temporary password
    const emailResponse = await resend.emails.send({
      from: "Alteryx New Hire Store <admin@whitestonebranding.com>",
      to: [email],
      bcc: ["dev@whitestonebranding.com"],
      subject: "Password to Redeem the Alteryx New Hire Bundle",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
          <p>Hi ${firstName},</p>
          <p>Here is your password to redeem your Alteryx New Hire Bundle:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <span style="font-size: 16px;">👉 </span>
            <strong style="font-size: 20px; color: #1e3a8a; font-family: monospace;">${tempPassword}</strong>
          </div>
          <p>The portal experience will automatically adjust based on your email address.</p>
          <p>If you have any trouble signing in, please contact <a href="mailto:admin@whitestonebranding.com" style="color: #1e3a8a; text-decoration: none;">admin@whitestonebranding.com</a>.</p>
          <br>
          <p>Thank you on behalf of Alteryx,</p>
          <p><strong>Whitestone</strong></p>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Failed to send password email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Password email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-password-email function:", error);
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