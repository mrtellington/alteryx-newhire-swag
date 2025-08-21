import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import React from 'npm:react@18.3.1';
import { OrderConfirmationEmail } from '../send-order-confirmation/_templates/order-confirmation.tsx';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testEmail } = await req.json();
    
    if (!testEmail) {
      return new Response(
        JSON.stringify({ error: 'testEmail is required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`Sending test email to: ${testEmail}`);

    // Test customer order confirmation email
    const customerEmailHtml = await renderAsync(
      React.createElement(OrderConfirmationEmail, {
        customerName: 'Tod Ellington',
        orderId: 'AYXNH1001',
        teeSize: 'Large',
        shippingAddress: `Tod Ellington<br/>
123 Test Street<br/>
Test City, TC 12345<br/>
United States`,
        isAdminNotification: false,
        customerEmail: testEmail,
        customerPhone: '555-123-4567'
      })
    );

    const customerEmailResult = await resend.emails.send({
      from: 'Alteryx New Hire Store <onboarding@resend.dev>',
      to: [testEmail],
      subject: '🎁 Your Alteryx Welcome Kit Is on the Way!',
      html: customerEmailHtml,
    });

    console.log('Test email sent successfully:', customerEmailResult);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: customerEmailResult.data?.id,
        message: `Test email sent to ${testEmail}`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error sending test email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send test email',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);