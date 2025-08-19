import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    console.log('Triggering cleanup of unauthorized auth users...');
    
    // Call the cleanup function
    const { data, error } = await supabase.functions.invoke('cleanup-auth-users', {
      body: {}
    });
    
    if (error) {
      console.error('Error calling cleanup function:', error);
      throw error;
    }
    
    console.log('Cleanup triggered successfully:', data);
    
    return new Response(JSON.stringify({
      message: 'Cleanup triggered successfully',
      result: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
    
  } catch (error) {
    console.error('Error triggering cleanup:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});