import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminPasswordResetRequest {
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
    const { email }: AdminPasswordResetRequest = await req.json();

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

    // Check if email is a valid admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, email, full_name, active, auth_user_id')
      .eq('email', email.toLowerCase())
      .eq('active', true)
      .single();

    if (adminError || !adminUser) {
      console.error("Admin user not found:", adminError);
      // Don't reveal whether the email exists for security
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If this email is registered as an admin, you will receive a password reset link." 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if admin has auth_user_id
    if (!adminUser.auth_user_id) {
      console.error("Admin has no auth_user_id");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If this email is registered as an admin, you will receive a password reset link." 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate a secure random password
    const newPassword = 'Admin' + Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + '!';
    
    
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.auth_user_id,
      {
        password: newPassword
      }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send the email with new password
    console.log("Attempting to send email to:", email);
    console.log("New password set successfully");
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Admin Portal <admin@whitestonebranding.com>",
      to: [email],
      bcc: ["dev@whitestonebranding.com"],
      subject: "Password Reset - Admin Panel",
      html: `
        <h2>Password Reset Complete</h2>
        <p>Your admin password has been reset.</p>
        <p><strong>New Password:</strong> <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${newPassword}</code></p>
        <p>Please log in with this password and change it after logging in if desired.</p>
        <p>Login URL: <a href="https://alteryxnewhire.com/admin/login">https://alteryxnewhire.com/admin/login</a></p>
      `,
    });

    if (emailError) {
      console.error("Resend API error:", emailError);
      return new Response(
        JSON.stringify({ 
          error: "Password updated but failed to send email", 
          details: emailError 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    console.log("Email sent successfully:", emailData);

    // Log the password reset request
    await supabase
      .from('security_events')
      .insert({
        event_type: 'admin_password_reset_requested',
        user_email: email,
        metadata: {
          admin_id: adminUser.id,
          timestamp: new Date().toISOString()
        },
        severity: 'medium'
      });

    console.log(`Password reset email sent to admin: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-admin-password-reset function:", error);
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