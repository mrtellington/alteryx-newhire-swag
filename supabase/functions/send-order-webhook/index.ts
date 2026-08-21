import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("ORDER_WEBHOOK_URL");
    if (!webhookUrl) throw new Error("Missing ORDER_WEBHOOK_URL secret");

    const { orderId } = await req.json().catch(() => ({ orderId: undefined }));

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw new Error(userErr?.message || "Not authenticated");

    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("id, email, full_name, shipping_address")
      .eq("auth_user_id", userRes.user.id)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!profile) throw new Error("User profile not found");

    let query = supabase
      .from("orders")
      .select(
        "id, order_number, date_submitted, tee_size, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, shipping_postal_code, shipping_country, shipping_phone",
      )
      .eq("user_id", profile.id);

    query = orderId
      ? query.eq("id", orderId)
      : query.order("date_submitted", { ascending: false }).limit(1);

    const { data: order, error: orderErr } = await query.maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) throw new Error("Order not found");

    const addr: any = profile.shipping_address ?? {};
    const line1 = order.shipping_line1 ?? addr.line1 ?? "";
    const line2 = order.shipping_line2 ?? addr.line2 ?? "";
    const city = order.shipping_city ?? addr.city ?? "";
    const region = order.shipping_region ?? addr.region ?? "";
    const postal = order.shipping_postal_code ?? addr.postal_code ?? "";
    const country = order.shipping_country ?? addr.country ?? "";

    const payload = {
      date_submitted: order.date_submitted,
      size: order.tee_size,
      order_number: order.order_number,
      shipping_name: order.shipping_name ?? profile.full_name ?? "",
      shipping_address: [line1, line2, city, region, postal, country].filter(Boolean).join(", "),
      shipping_address_line1: line1,
      shipping_address_line2: line2,
      shipping_city: city,
      shipping_region: region,
      shipping_postal_code: postal,
      shipping_country: country,
      shipping_phone: order.shipping_phone ?? addr.phone ?? "",
      email: profile.email,
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error(`Zapier webhook failed [${res.status}]: ${body}`);
      return new Response(JSON.stringify({ error: "Webhook failed", status: res.status, details: body }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: res.status,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("send-order-webhook error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
