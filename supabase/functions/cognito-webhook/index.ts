import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

const EXPECTED_ORIGINS = [
  'cognito-webhook.zapier.com',
  'hooks.zapier.com',
  'api.zapier.com',
  'alteryxnewhire.com',
  'localhost:5173',
  '127.0.0.1:5173'
];

interface CognitoFormData {
  email?: string;
  Email?: string;
  'Email Address'?: string;
  full_name?: string;
  'Full Name'?: string;
  Name?: string;
  first_name?: string;
  'First Name'?: string;
  FirstName?: string;
  last_name?: string;
  'Last Name'?: string;
  LastName?: string;
  shipping_address?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };
}

// Use service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const handler = async (req: Request): Promise<Response> => {
  console.log('=== WEBHOOK DEBUG: Request received ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('=== WEBHOOK DEBUG: Handling OPTIONS request ===');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  const origin = req.headers.get('origin') || '';
  const userAgent = req.headers.get('user-agent') || '';
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

  console.log('Headers:', Object.fromEntries(req.headers));
  
  // Validate origin
  const isValidOrigin = EXPECTED_ORIGINS.some(validOrigin => origin.includes(validOrigin));
  
  console.log('Request details:', {
    origin,
    userAgent,
    clientIP,
    isValidOrigin
  });

  if (!isValidOrigin) {
    console.error('Suspicious request from unexpected origin:', {
      origin,
      userAgent,
      clientIP
    });
    
    // Log security event
    await supabase.rpc('log_security_event', {
      event_type: 'webhook_suspicious_origin',
      metadata: {
        origin,
        user_agent: userAgent,
        client_ip: clientIP,
        expected_origins: EXPECTED_ORIGINS
      }
    });
  }

  try {
    console.log('Webhook received from Cognito Forms - Fixed foreign key constraints');
    console.log('=== WEBHOOK DEBUG: Starting to process request ===');

    let formData: CognitoFormData;
    try {
      formData = await req.json();
      console.log('=== WEBHOOK DEBUG: Successfully parsed JSON ===');
    } catch (error) {
      console.error('=== WEBHOOK DEBUG: Failed to parse JSON ===');
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON data' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Form data received:', JSON.stringify(formData, null, 2));

    // Extract and normalize email
    const email = (
      formData.email || 
      formData.Email || 
      formData['Email Address'] || 
      ''
    ).toLowerCase().trim();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Extract and normalize names
    const fullName = (
      formData.full_name ||
      formData['Full Name'] ||
      formData.Name ||
      ''
    ).trim();

    const firstName = (
      formData.first_name ||
      formData['First Name'] ||
      formData.FirstName ||
      ''
    ).trim();

    const lastName = (
      formData.last_name ||
      formData['Last Name'] ||
      formData.LastName ||
      ''  
    ).trim();

    // Parse names intelligently
    let parsedFirstName = firstName;
    let parsedLastName = lastName;
    let parsedFullName = fullName;

    // If we have a full name but missing individual names, split it
    if (fullName && (!firstName || !lastName)) {
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length >= 2) {
        parsedFirstName = parsedFirstName || nameParts[0];
        parsedLastName = parsedLastName || nameParts.slice(1).join(' ');
      }
    }

    // If we have individual names but no full name, construct it
    if ((parsedFirstName || parsedLastName) && !parsedFullName) {
      parsedFullName = `${parsedFirstName} ${parsedLastName}`.trim();
    }

    console.log('Parsed name components:', {
      firstName: parsedFirstName,
      lastName: parsedLastName,
      fullName: parsedFullName
    });

    // Extract shipping address if provided
    let shippingAddress = null;
    if (formData.shipping_address && typeof formData.shipping_address === 'object') {
      const addr = formData.shipping_address;
      if (addr.address || addr.city || addr.state || addr.zip || addr.phone) {
        shippingAddress = {
          address: addr.address || '',
          city: addr.city || '',
          state: addr.state || '',
          zip: addr.zip || '',
          phone: addr.phone || ''
        };
      }
    }

    // Validate email domain
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!['alteryx.com', 'whitestonebranding.com'].includes(emailDomain) && email !== 'tod.ellington@gmail.com') {
      // Log security event for invalid domain
      await supabase.rpc('log_security_event', {
        event_type: 'webhook_invalid_domain',
        metadata: {
          email,
          domain: emailDomain,
          client_ip: clientIP
        }
      });

      return new Response(
        JSON.stringify({ 
          error: 'Invalid email domain',
          message: 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed'
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Log webhook access
    await supabase.rpc('log_security_event', {
      event_type: 'webhook_access',
      metadata: {
        email,
        origin,
        user_agent: userAgent,
        client_ip: clientIP,
        is_valid_origin: isValidOrigin
      }
    });

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, auth_user_id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      return new Response(
        JSON.stringify({ 
          error: 'Database error',
          message: checkError.message
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('About to call create_user_from_webhook with:', {
      user_email: email,
      user_full_name: parsedFullName,
      user_first_name: parsedFirstName,
      user_last_name: parsedLastName,
      user_shipping_address: shippingAddress,
      auth_user_id: null
    });

    // Create or update user record using RPC function
    const { data: result, error: rpcError } = await supabase
      .rpc('create_user_from_webhook', {
        user_email: email,
        user_full_name: parsedFullName || null,
        user_first_name: parsedFirstName || null,
        user_last_name: parsedLastName || null,
        user_shipping_address: shippingAddress,
        auth_user_id: null
      });
    
    console.log('RPC result:', result);

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ 
          error: 'Database RPC error',
          message: rpcError.message
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Handle the JSONB response from the function
    if (result?.createError) {
      console.error('Error creating user:', result.createError);
      
      if (result.createError.code === 'INVALID_DOMAIN') {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid email domain',
            message: result.createError.message
          }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user',
          message: result.createError.message,
          details: result.createError
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Now create the auth user and link it to the database user
    let authUserId = null;
    
    try {
      console.log(`Creating Supabase Auth user for: ${email}`);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          full_name: parsedFullName,
          invited_via: 'cognito_webhook'
        }
      });

      if (authError) {
        console.error('Auth user creation failed:', authError);
        
        // If user already exists in auth, find them
        if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
          console.log('User already exists in auth, attempting to find existing auth user');
          const { data: authUsers, error: lookupError } = await supabase.auth.admin.listUsers();
          
          if (!lookupError && authUsers?.users) {
            const existingAuthUser = authUsers.users.find(user => user.email?.toLowerCase() === email);
            if (existingAuthUser) {
              authUserId = existingAuthUser.id;
              console.log(`Found existing auth user with ID: ${authUserId}`);
            }
          }
        }
        
        if (!authUserId) {
          throw new Error(`Failed to create or find auth user: ${authError.message}`);
        }
      } else {
        authUserId = authData.user?.id;
        console.log(`Supabase Auth user created with ID: ${authUserId}`);
      }
      
      // Update the database user record with the auth_user_id
      if (authUserId) {
        console.log('Updating database user record with auth_user_id');
        const { error: updateError } = await supabase
          .from('users')
          .update({ auth_user_id: authUserId })
          .eq('id', result.userId);
          
        if (updateError) {
          console.error('Error updating user with auth_user_id:', updateError);
          throw new Error(`Failed to link auth user: ${updateError.message}`);
        } else {
          console.log('Successfully linked auth user to database user');
        }
      }
    } catch (authSetupError) {
      console.error('Error in auth user setup:', authSetupError);
      
      // Return error if auth user creation completely fails
      return new Response(
        JSON.stringify({ 
          error: 'Auth user creation failed',
          message: authSetupError.message,
          details: 'User was created in database but cannot login without auth account'
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User processed successfully',
        userId: result.userId,
        authUserId: authUserId,
        canLogin: !!authUserId
      }),
      { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in cognito-webhook function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);