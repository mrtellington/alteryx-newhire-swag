import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_TO = ["emily.robertson@whitestonebranding.com"];
const ALERT_CC = ["kevin.chambers@whitestonebranding.com"];

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId : null;
    const blocked = body.blocked === true;

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin
      .from("users").select("email, full_name, shipping_address").eq("auth_user_id", u.user.id).maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);

    const a = profile.shipping_address || {};
    const name = `${a.first_name || ""} ${a.last_name || ""}`.trim() || profile.full_name || "";

    let orderNumber: string | null = null;
    if (orderId) {
      const { data: o } = await admin.from("orders").select("order_number").eq("id", orderId).maybeSingle();
      orderNumber = o?.order_number ?? null;
    }

    const { data: matches, error: mErr } = await admin.rpc("find_order_duplicates", {
      p_name: name, p_line1: a.line1 || "", p_city: a.city || "", p_postal: a.postal_code || "", p_exclude_order: orderId,
    });
    if (mErr) throw mErr;
    if (!matches || matches.length === 0) return json({ ok: true, alerted: false });

    const nameMatch = matches.some((m: any) => m.name_matches);
    const kind = blocked || nameMatch ? "Name + address match (order BLOCKED)" : "Address-only match (order placed)";

    const rows = matches.map((m: any) =>
      `<tr><td>${esc(m.order_number)}</td><td>${esc(m.shipping_name)}</td><td>${esc(m.shipping_line1)}, ${esc(m.shipping_city)} ${esc(m.shipping_postal_code)}</td><td>${esc(new Date(m.date_submitted).toLocaleString("en-US"))}</td><td>${m.name_matches ? "Yes" : "No"}</td></tr>`
    ).join("");

    const html = `
      <h2>Possible duplicate New Hire Bundle order</h2>
      <p><strong>Type:</strong> ${esc(kind)}</p>
      <h3>New submission</h3>
      <p>${blocked ? "<strong>Status:</strong> Blocked – not placed<br/>" : `<strong>Order:</strong> ${esc(orderNumber)}<br/>`}
      <strong>Email:</strong> ${esc(profile.email)}<br/>
      <strong>Name:</strong> ${esc(name)}<br/>
      <strong>Address:</strong> ${esc(a.line1)} ${esc(a.line2 || "")}, ${esc(a.city)}, ${esc(a.region)} ${esc(a.postal_code)}, ${esc(a.country)}<br/>
      <strong>Phone:</strong> ${esc(a.phone)}</p>
      <h3>Matching existing orders</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px">
        <tr><th>Order</th><th>Name</th><th>Address</th><th>Date</th><th>Name match</th></tr>${rows}
      </table>`;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
    await resend.emails.send({
      from: "Whitestone <admin@whitestonebranding.com>",
      to: ALERT_TO,
      cc: ALERT_CC,
      subject: `Duplicate order alert: ${blocked || nameMatch ? "BLOCKED name + address match" : "address match"} – ${name}`,
      html,
    });
    return json({ ok: true, alerted: true });
  } catch (e: any) {
    console.error("duplicate-order-alert error", e);
    return json({ error: e?.message || "error" }, 500);
  }
});
