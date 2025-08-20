import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-csrf-token",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;",
  "X-Rate-Limit-Remaining": "100",
  "X-Rate-Limit-Reset": "3600"
};

function normalizeAddress(components: Array<{ long_name: string; short_name: string; types: string[] }>) {
  const get = (type: string, useShort = false) => {
    const comp = components.find((c) => c.types.includes(type));
    return comp ? (useShort ? comp.short_name : comp.long_name) : "";
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const subpremise = get("subpremise");
  const city = get("locality") || get("postal_town") || get("administrative_area_level_2");
  const region = get("administrative_area_level_1", true) || get("administrative_area_level_2", true);
  const postal_code = get("postal_code");
  const country = get("country", true); // ISO alpha-2

  const line1 = [streetNumber, route].filter(Boolean).join(" ");
  const line2 = subpremise;

  return { line1, line2, city, region, postal_code, country };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`Address autocomplete request: ${req.method} from ${req.headers.get('origin') || 'unknown'}`);

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  console.log(`API Key present: ${apiKey ? 'yes' : 'no'}`);
  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY environment variable is missing");
    return new Response(JSON.stringify({ error: "Missing GOOGLE_PLACES_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    const { type, input, place_id, sessiontoken } = body;

    if (type === "autocomplete") {
      console.log(`Autocomplete request for: "${input}"`);
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", input ?? "");
      url.searchParams.set("types", "address");
      url.searchParams.set("key", apiKey);
      if (sessiontoken) url.searchParams.set("sessiontoken", sessiontoken);

      const resp = await fetch(url.toString());
      const data = await resp.json();
      console.log(`Google API response status: ${data.status}`);
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("Places Autocomplete error", data);
        return new Response(JSON.stringify({ error: data.status, message: data.error_message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const results = (data.predictions || []).map((p: any) => ({
        description: p.description as string,
        place_id: p.place_id as string,
      }));
      console.log(`Returning ${results.length} autocomplete results`);
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "details") {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", place_id ?? "");
      url.searchParams.set("fields", "address_component,formatted_address");
      url.searchParams.set("key", apiKey);
      if (sessiontoken) url.searchParams.set("sessiontoken", sessiontoken);

      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.status !== "OK") {
        console.error("Place Details error", data);
        return new Response(JSON.stringify({ error: data.status, message: data.error_message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const normalized = normalizeAddress(data.result.address_components || []);
      return new Response(JSON.stringify({ address: normalized }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("address-autocomplete error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
