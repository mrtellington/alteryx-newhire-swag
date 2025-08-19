import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

const EXPECTED_ORIGINS = [
  'cognito-webhook.zapier.com',
  'hooks.zapier.com',
  'www.cognitoforms.com'
];

interface CognitoFormData {
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  // Add other potential field names that Cognito Forms might send
  [key: string]: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }

  try {
    // Enhanced security: Check request origin
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    
    const isValidOrigin = EXPECTED_ORIGINS.some(expectedOrigin => 
      origin.includes(expectedOrigin) || userAgent.includes('Zapier')
    );

    if (!isValidOrigin) {
      console.warn('Suspicious request from unexpected origin:', { origin, userAgent, clientIP });
      // Log but don't block to avoid false positives
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Webhook received from Cognito Forms - Enhanced security deployment');
    console.log('Request details:', { origin, userAgent, clientIP, isValidOrigin });
    
    console.log('=== WEBHOOK DEBUG: Starting to process request ===');
    const formData: CognitoFormData = await req.json();
    console.log('=== WEBHOOK DEBUG: Successfully parsed JSON ===');

    // Log security event for webhook access
    await supabase.rpc('log_security_event', {
      event_type: 'webhook_access',
      metadata: { 
        origin, 
        userAgent, 
        clientIP,
        valid_origin: isValidOrigin 
      }
    });
    console.log('Form data received:', JSON.stringify(formData, null, 2));

    // Extract email from various possible field names
    const email = formData.email || 
                  formData.Email || 
                  formData.emailAddress || 
                  formData.EmailAddress ||
                  formData['Email Address'];

    // Extract name components properly
    let fullName = '';
    let firstName = '';
    let lastName = '';

    // First try to get full name directly
    fullName = formData.fullName || 
               formData.FullName || 
               formData.name || 
               formData['Full Name'] || '';

    // Extract first and last names from various sources
    firstName = formData.firstName || formData.FirstName || formData['First Name'] || '';
    lastName = formData.lastName || formData.LastName || formData['Last Name'] || '';

    // Handle nested name object from Cognito Forms (most common case)
    if (formData.Name && typeof formData.Name === 'object') {
      const nameObj = formData.Name;
      
      // Extract individual components
      firstName = nameObj.First || firstName;
      lastName = nameObj.Last || lastName;
      
      // Use FirstAndLast if available, otherwise construct from parts
      if (nameObj.FirstAndLast) {
        fullName = nameObj.FirstAndLast;
      } else if (firstName && lastName) {
        fullName = `${firstName} ${lastName}`;
      } else if (firstName) {
        fullName = firstName;
      }
    } else if (!fullName && firstName && lastName) {
      // Construct full name from first/last if not already set
      fullName = `${firstName} ${lastName}`;
    } else if (!fullName && firstName) {
      fullName = firstName;
    }

    console.log('Parsed name components:', { firstName, lastName, fullName });

    if (!email) {
      console.error('No email found in form data');
      return new Response(
        JSON.stringify({ 
          error: 'Email is required',
          message: 'No email address found in the form submission'
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Validate email domain with enhanced security logging
    const emailLower = email.toLowerCase().trim();
    if (emailLower !== 'tod.ellington@gmail.com' && !emailLower.endsWith('@alteryx.com') && !emailLower.endsWith('@whitestonebranding.com')) {
      console.log(`Invalid email domain: ${emailLower}`);
      
      // Log security event for invalid domain attempts
      await supabase.rpc('log_security_event', {
        event_type: 'webhook_invalid_domain',
        metadata: { 
          email: emailLower, 
          rejected_domain: emailLower.split('@')[1],
          origin,
          userAgent,
          clientIP
        }
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid email domain',
          message: 'Only @alteryx.com and @whitestonebranding.com email addresses are allowed'
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, invited, auth_user_id')
      .eq('email', emailLower)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      return new Response(
        JSON.stringify({ 
          error: 'Database error',
          message: 'Error checking user status'
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    let authUserId = null;

    // Create Supabase Auth user if one doesn't exist or if existing user has no auth_user_id
    if (!existingUser || !existingUser.auth_user_id) {
      console.log(`Creating Supabase Auth user for: ${emailLower}`);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: emailLower,
        email_confirm: true, // Auto-confirm the email
        user_metadata: {
          full_name: fullName,
          invited_via: 'cognito_forms'
        }
      });

      if (authError) {
        console.error('Error creating Supabase Auth user:', authError);
        // Continue without auth user - they can still be in the users table
        console.log('Continuing without auth user creation');
      } else {
        authUserId = authData.user?.id;
        console.log(`Supabase Auth user created with ID: ${authUserId}`);
      }
    }

    if (existingUser) {
      console.log(`User already exists: ${emailLower}`);
      
      // If we just created an auth user, update the existing record
      if (authUserId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ auth_user_id: authUserId })
          .eq('id', existingUser.id);
          
        if (updateError) {
          console.error('Error updating user with auth_user_id:', updateError);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: authUserId ? 'User updated with auth capabilities' : 'User already exists in the system',
          user: {
            email: existingUser.email,
            invited: existingUser.invited,
            canLogin: Boolean(authUserId || existingUser.auth_user_id)
          }
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Create shipping address object from form data if available
    const shippingAddress: any = {};
    
    // Map common address fields
    if (formData.address || formData.Address) {
      shippingAddress.line1 = formData.address || formData.Address;
    }
    if (formData.city || formData.City) {
      shippingAddress.city = formData.city || formData.City;
    }
    if (formData.state || formData.State) {
      shippingAddress.region = formData.state || formData.State;
    }
    if (formData.zipCode || formData.ZipCode || formData.zip || formData.Zip) {
      shippingAddress.postal_code = formData.zipCode || formData.ZipCode || formData.zip || formData.Zip;
    }
    if (formData.country || formData.Country) {
      shippingAddress.country = formData.country || formData.Country;
    }
    if (formData.phone || formData.Phone) {
      shippingAddress.phone = formData.phone || formData.Phone;
    }

    // Call the database function to create the user
    console.log('About to call create_user_from_webhook with:', {
      user_email: emailLower,
      user_full_name: fullName || null,
      user_first_name: firstName || null,
      user_last_name: lastName || null,
      user_shipping_address: Object.keys(shippingAddress).length > 0 ? shippingAddress : null,
      auth_user_id: authUserId
    });
    
    const { data: result, error: rpcError } = await supabase
      .rpc('create_user_from_webhook', {
        user_email: emailLower,
        user_full_name: fullName || null,
        user_first_name: firstName || null,
        user_last_name: lastName || null,
        user_shipping_address: Object.keys(shippingAddress).length > 0 ? shippingAddress : null,
        auth_user_id: authUserId
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

    console.log(`User processed successfully: ${emailLower}, ID: ${result.userId}, Message: ${result.message}`);
    
    // Log successful user processing
    await supabase.rpc('log_security_event', {
      event_type: 'webhook_user_processed',
      metadata: { 
        email: emailLower, 
        user_id: result.userId,
        action: result.message?.includes('updated') ? 'updated' : 'created',
        auth_user_created: Boolean(authUserId)
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: result.message || 'User processed successfully',
        user: {
          id: result.userId,
          email: emailLower,
          fullName: fullName,
          invited: true,
          canLogin: Boolean(authUserId)
        }
      }),
      { 
        status: result.message?.includes('updated') ? 200 : 201, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in cognito-webhook function:', error);
    
    // Log security event for unexpected errors
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.rpc('log_security_event', {
        event_type: 'webhook_unexpected_error',
        metadata: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);