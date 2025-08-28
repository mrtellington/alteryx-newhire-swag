import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Always return success to allow Supabase's default email functionality
  // This prevents the 500 errors that were blocking auth
  console.log('Auth email hook bypassed - allowing default Supabase email handling');
  
  return new Response(JSON.stringify({ message: 'Hook bypassed - using default email' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});