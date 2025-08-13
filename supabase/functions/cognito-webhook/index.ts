import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Webhook received from Cognito Forms');
    
    const formData: CognitoFormData = await req.json();
    console.log('Form data received:', JSON.stringify(formData, null, 2));

    // Extract email from various possible field names
    const email = formData.email || 
                  formData.Email || 
                  formData.emailAddress || 
                  formData.EmailAddress ||
                  formData['Email Address'];

    // Extract full name from various possible field names
    let fullName = formData.fullName || 
                   formData.FullName || 
                   formData.name || 
                   formData.Name ||
                   formData['Full Name'];

    // If no full name, try to construct from first/last name
    if (!fullName) {
      const firstName = formData.firstName || formData.FirstName || formData['First Name'];
      const lastName = formData.lastName || formData.LastName || formData['Last Name'];
      if (firstName && lastName) {
        fullName = `${firstName} ${lastName}`;
      } else if (firstName) {
        fullName = firstName;
      }
    }

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

    // Validate email domain
    const emailLower = email.toLowerCase().trim();
    if (!emailLower.endsWith('@alteryx.com') && !emailLower.endsWith('@whitestonebranding.com')) {
      console.log(`Invalid email domain: ${emailLower}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid email domain',
          message: 'Only @alteryx.com and @whitestonebranding.com email addresses are allowed'
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, invited')
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

    if (existingUser) {
      console.log(`User already exists: ${emailLower}`);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User already exists in the system',
          user: {
            email: existingUser.email,
            invited: existingUser.invited
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
    const { data: userId, error: createError } = await supabase
      .rpc('create_user_from_webhook', {
        user_email: emailLower,
        user_full_name: fullName || null,
        user_shipping_address: Object.keys(shippingAddress).length > 0 ? shippingAddress : null
      });

    if (createError) {
      console.error('Error creating user:', createError);
      
      if (createError.message.includes('already exists')) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'User already exists in the system'
          }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user',
          message: createError.message
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`User created successfully: ${emailLower}, ID: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User created successfully',
        user: {
          id: userId,
          email: emailLower,
          fullName: fullName,
          invited: true
        }
      }),
      { 
        status: 201, 
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
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);