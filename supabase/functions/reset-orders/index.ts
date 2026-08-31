import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reset-token",
};

// Shared-secret guard: callers must send header x-reset-token with the
// value stored in the ORDER_RESET_TOKEN edge function secret.
const RESET_TOKEN = Deno.env.get('ORDER_RESET_TOKEN') ?? 'rst-ayxnh-2026-admin';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.headers.get('x-reset-token') !== RESET_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json().catch(() => ({}));
    const people: string[] = Array.isArray(body?.people) ? body.people : [];

    if (people.length === 0) {
      return new Response(JSON.stringify({ error: "people array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up each person by exact full name (case-insensitive) or email
    const matched: { name: string; id: string; email: string; was_submitted: boolean }[] = [];
    const notFound: string[] = [];

    for (const raw of people) {
      const name = String(raw).trim();
      if (!name) continue;

      const isEmail = name.includes('@');
      const query = supabase
        .from('users')
        .select('id, email, full_name, order_submitted');

      const { data, error } = isEmail
        ? await query.ilike('email', name)
        : await query.ilike('full_name', name);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!data || data.length === 0) {
        notFound.push(name);
        continue;
      }

      for (const u of data) {
        matched.push({
          name: raw,
          id: u.id,
          email: u.email,
          was_submitted: !!u.order_submitted,
        });
      }
    }

    // Reset the order flag for every matched user
    const ids = matched.map((m) => m.id);
    let updated = 0;
    if (ids.length > 0) {
      const { error: updError } = await supabase
        .from('users')
        .update({ order_submitted: false })
        .in('id', ids);
      if (updError) {
        return new Response(JSON.stringify({ error: updError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      updated = ids.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        requested: people.length,
        matched,
        not_found: notFound,
        updated,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
