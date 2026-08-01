import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { DeliveryNotificationEmail } from './_templates/delivery-notification.tsx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !resendKey) {
      console.error("Missing environment variables");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRole, error: roleError } = await supabaseAuth.rpc('get_admin_role');
    if (roleError || userRole !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Access denied: Only full administrators can send delivery notifications',
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`id, order_number, user_id, users!inner ( email, full_name )`)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Error fetching order:", orderError);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user: any = order.users;
    const userEmail = user.email;
    const fullName = user.full_name || userEmail.split("@")[0];

    const resend = new Resend(resendKey);
    const html = await renderAsync(
      React.createElement(DeliveryNotificationEmail, { customerName: fullName })
    );

    const emailResult = await resend.emails.send({
      from: "admin@whitestonebranding.com",
      to: [userEmail],
      subject: "🎉 Your Alteryx Kit Has Arrived!",
      html,
    });

    if (emailResult.error) {
      console.error("Error sending delivery notification:", emailResult.error);
      return new Response(JSON.stringify({ error: "Failed to send delivery notification" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, message_id: emailResult.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in send-delivery-notification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);