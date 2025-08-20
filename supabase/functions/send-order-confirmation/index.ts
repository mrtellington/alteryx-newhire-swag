import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { OrderConfirmationEmail } from './_templates/order-confirmation.tsx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

interface SendOrderBody {
  orderId?: string;
}

function formatAddress(addr: any) {
  if (!addr) return "";
  const line1 = addr.line1 || "";
  const line2 = addr.line2 ? `, ${addr.line2}` : "";
  const city = addr.city || "";
  const region = addr.region || "";
  const postal = addr.postal_code || "";
  const country = addr.country || "";
  return `${line1}${line2}<br/>${city}, ${region} ${postal}<br/>${country}`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`Order confirmation request: ${req.method} for user ${req.headers.get('authorization') ? 'authenticated' : 'anonymous'}`);

  try {
    const requestBody = await req.json().catch(() => ({}));
    console.log("Request body received:", requestBody);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY secret");
    }

    const { orderId }: SendOrderBody = requestBody;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      throw new Error(userErr?.message || "Not authenticated");
    }

    const user = userRes.user;
    const userEmail = user.email || "";

    // Fetch profile for shipping address and full name using auth_user_id
    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("id, full_name, shipping_address")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    // Fetch order data including tee size and order number using the profile.id
    let teeSize = null;
    let orderNumber = null;
    if (profile?.id) {
      console.log(`Looking for order with orderId: ${orderId} and user_id: ${profile.id}`);
      
      let orderQuery = supabase
        .from("orders")
        .select("id, tee_size, order_number, date_submitted")
        .eq("user_id", profile.id);
      
      // If orderId is provided, use it for more precise lookup, otherwise get the latest
      if (orderId) {
        orderQuery = orderQuery.eq("id", orderId);
      } else {
        orderQuery = orderQuery.order("date_submitted", { ascending: false }).limit(1);
      }
      
      const { data: orderData, error: orderErr } = await orderQuery.maybeSingle();
      
      console.log("Order query result:", { orderData, orderErr, userId: profile.id, providedOrderId: orderId });
      
      if (!orderErr && orderData) {
        teeSize = orderData.tee_size;
        orderNumber = orderData.order_number;
        console.log(`Found order data: teeSize=${teeSize}, orderNumber=${orderNumber}, orderId=${orderData.id}`);
      } else {
        console.log("No order data found or error occurred:", orderErr);
        // If no specific order found but user has orders, get the latest
        if (!orderId) {
          const { data: latestOrder, error: latestErr } = await supabase
            .from("orders")
            .select("id, tee_size, order_number, date_submitted")
            .eq("user_id", profile.id)
            .order("date_submitted", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!latestErr && latestOrder) {
            teeSize = latestOrder.tee_size;
            orderNumber = latestOrder.order_number;
            console.log(`Found latest order: teeSize=${teeSize}, orderNumber=${orderNumber}, orderId=${latestOrder.id}`);
          }
        }
      }
    }

    const fullName = profile?.full_name || userEmail.split("@")[0];
    const shippingHtml = formatAddress(profile?.shipping_address);
    const customerPhone = profile?.shipping_address?.phone;

    const resend = new Resend(resendKey);

    const adminEmail = "admin@whitestonebranding.com";

    // Render React Email templates
    const userHtml = await renderAsync(
      React.createElement(OrderConfirmationEmail, {
        customerName: fullName,
        orderId: orderNumber,
        teeSize,
        shippingAddress: shippingHtml,
        isAdminNotification: false,
      })
    );

    const adminHtml = await renderAsync(
      React.createElement(OrderConfirmationEmail, {
        customerName: fullName,
        orderId: orderNumber,
        teeSize,
        shippingAddress: shippingHtml,
        isAdminNotification: true,
        customerEmail: userEmail,
        customerPhone,
      })
    );

    // Send to customer only
    const userSend = await resend.emails.send({
      from: "admin@whitestonebranding.com",
      to: [userEmail],
      subject: "Your order confirmation",
      html: userHtml,
    });

    // Send admin notification separately
    const adminSend = await resend.emails.send({
      from: "admin@whitestonebranding.com",
      to: [adminEmail],
      subject: `New order received${orderNumber ? ` - ${orderNumber}` : ""}`,
      html: adminHtml,
    });

    return new Response(
      JSON.stringify({ ok: true, customer_msg_id: userSend?.data?.id, admin_msg_id: adminSend?.data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("send-order-confirmation error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
