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

    const normalizedEmail = email.trim().toLowerCase();

    // Restrict access to authorized domains only
    if (
      !normalizedEmail.endsWith("@alteryx.com") &&
      !normalizedEmail.endsWith("@whitestonebranding.com")
    ) {
      return new Response(
        JSON.stringify({
          error: "This application is only available to authorized Alteryx New Hire users.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up (or provision) the application user record — one row per email
    let { data: userData } = await supabase
      .from('users')
      .select('id, email, auth_user_id, first_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // Generate a cryptographically secure temporary password
    const tempPassword = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // Resolve the auth account: reuse existing, otherwise create it
    let authUserId: string | null = userData?.auth_user_id ?? null;

    if (authUserId) {
      const { data: existingAuth } = await supabase.auth.admin.getUserById(authUserId);
      if (!existingAuth?.user) authUserId = null;
    }

    if (!authUserId) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
      });

      if (created?.user) {
        authUserId = created.user.id;
      } else {
        // Auth account already exists — find and link it
        let page = 1;
        const perPage = 200;
        while (!authUserId) {
          const { data: list } = await supabase.auth.admin.listUsers({ page, perPage });
          if (!list?.users?.length) break;
          const match = list.users.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (match) { authUserId = match.id; break; }
          if (list.users.length < perPage) break;
          page++;
        }

        if (!authUserId) {
          console.error("Could not create or find auth user:", createError);
          return new Response(
            JSON.stringify({ error: "Unable to set up your account. Please contact support." }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    if (!userData) {
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          email: normalizedEmail,
          full_name: normalizedEmail.split('@')[0],
          invited: true,
          auth_user_id: authUserId,
          shipping_address: {},
        })
        .select('id, email, auth_user_id, first_name')
        .single();

      if (insertError) {
        // Race: a row was created concurrently — reuse it
        const { data: existing } = await supabase
          .from('users')
          .select('id, email, auth_user_id, first_name')
          .eq('email', normalizedEmail)
          .maybeSingle();
        userData = existing ?? null;
      } else {
        userData = inserted;
      }

      if (!userData) {
        return new Response(
          JSON.stringify({ error: "Unable to set up your account. Please contact support." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (userData.auth_user_id !== authUserId) {
      await supabase.from('users').update({ auth_user_id: authUserId, invited: true }).eq('id', userData.id);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
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
      from: "Whitestone <admin@whitestonebranding.com>",
      to: [normalizedEmail],
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