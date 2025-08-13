import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { OrderConfirmationEmail } from './_templates/order-confirmation.tsx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY secret");
    }

    const { orderId }: SendOrderBody = await req.json().catch(() => ({}));

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

    // Fetch profile for shipping address and full name (RLS allows own row)
    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("full_name, shipping_address")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    const fullName = profile?.full_name || userEmail.split("@")[0];
    const shippingHtml = formatAddress(profile?.shipping_address);

    const resend = new Resend(resendKey);

    const adminEmail = "admin@whitestonebranding.com";

    // Render React Email templates
    const userHtml = await renderAsync(
      React.createElement(OrderConfirmationEmail, {
        customerName: fullName,
        orderId,
        shippingAddress: shippingHtml,
        isAdminNotification: false,
      })
    );

    const adminHtml = await renderAsync(
      React.createElement(OrderConfirmationEmail, {
        customerName: fullName,
        orderId,
        shippingAddress: shippingHtml,
        isAdminNotification: true,
        customerEmail: userEmail,
      })
    );

    // Send to customer (bcc admin)
    const userSend = await resend.emails.send({
      from: "admin@whitestonebranding.com",
      to: [userEmail],
      bcc: [adminEmail],
      subject: "Your order confirmation",
      html: userHtml,
    });

    // Also send a dedicated admin notification (optional redundancy)
    const adminSend = await resend.emails.send({
      from: "admin@whitestonebranding.com",
      to: [adminEmail],
      subject: `New order received${orderId ? ` - ${orderId}` : ""}`,
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
