import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { TrackingNotificationEmail } from './_templates/tracking-notification.tsx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

interface TrackingNotificationRequest {
  orderId: string;
}

function formatAddress(address: any): string {
  if (!address) return 'Address not provided';
  
  const parts = [];
  if (address.name) parts.push(`<strong>${address.name}</strong>`);
  if (address.street) parts.push(address.street);
  if (address.street2) parts.push(address.street2);
  
  const cityStateZip = [];
  if (address.city) cityStateZip.push(address.city);
  if (address.state) cityStateZip.push(address.state);
  if (address.zip) cityStateZip.push(address.zip);
  if (cityStateZip.length > 0) parts.push(cityStateZip.join(', '));
  
  if (address.country && address.country !== 'US') parts.push(address.country);
  if (address.phone) parts.push(`Phone: ${address.phone}`);
  
  return parts.join('<br>');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { orderId }: TrackingNotificationRequest = await req.json();
    console.log('Sending tracking notification for order:', orderId);

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !resendKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order details with user information
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        tracking_number,
        shipping_carrier,
        tee_size,
        user_id,
        users!inner (
          email,
          full_name,
          shipping_address
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error("Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.tracking_number) {
      console.log("Order has no tracking number, skipping notification");
      return new Response(
        JSON.stringify({ message: "No tracking number found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = order.users;
    const userEmail = user.email;
    const fullName = user.full_name || userEmail.split("@")[0];
    const shippingHtml = formatAddress(user.shipping_address);

    console.log('Sending tracking notification to:', userEmail);

    const resend = new Resend(resendKey);

    // Render React Email template
    const html = await renderAsync(
      React.createElement(TrackingNotificationEmail, {
        customerName: fullName,
        orderId: order.order_number || order.id,
        trackingNumber: order.tracking_number,
        shippingCarrier: order.shipping_carrier,
        shippingAddress: shippingHtml,
        teeSize: order.tee_size,
      })
    );

    // Send email to customer
    const emailResult = await resend.emails.send({
      from: "admin@whitestonebranding.com",
      to: [userEmail],
      subject: `Your Alteryx New Hire Bundle has shipped! 📦`,
      html: html,
    });

    if (emailResult.error) {
      console.error("Error sending tracking notification:", emailResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to send tracking notification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Tracking notification sent successfully:', emailResult.data?.id);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message_id: emailResult.data?.id,
        tracking_number: order.tracking_number
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in send-tracking-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);