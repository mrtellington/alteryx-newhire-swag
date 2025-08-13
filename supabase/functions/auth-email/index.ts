import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const resendApiKey = Deno.env.get('RESEND_API_KEY') as string
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') as string

// Initialize SMTP client
const smtpClient = new SMTPClient({
  connection: {
    hostname: "smtp.resend.com",
    port: 587,
    tls: true,
    auth: {
      username: "resend",
      password: resendApiKey,
    },
  },
});

Deno.serve(async (req) => {
  console.log('Auth email function called - Updated deployment:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  
  console.log('Webhook payload received:', {
    payloadLength: payload.length,
    hasSecret: !!hookSecret,
    contentType: headers['content-type']
  });
  
  const wh = new Webhook(hookSecret)
  
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
      }
    }

    // Only handle magic link emails (not password reset, etc.)
    if (email_action_type !== 'magiclink') {
      return new Response('Email type not handled', { status: 200 })
    }

    // Initialize Supabase client to fetch user data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user details including name
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, first_name, last_name, full_name, order_submitted, orders(order_number, date_submitted)')
      .eq('email', user.email)
      .single();

    let userName = '';
    if (userData) {
      if (userData.first_name && userData.last_name) {
        userName = `${userData.first_name} ${userData.last_name}`;
      } else if (userData.full_name) {
        userName = userData.full_name;
      }
    }

    console.log('User data for email:', { email: user.email, userName, userData });

    // Create HTML email content
    const loginLink = `${redirect_to}#access_token=${token}&token_type=bearer&type=magiclink`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Alteryx – Redeem Your New Hire Bundle</title>
        </head>
        <body style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif; background-color: #ffffff; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px 0 48px;">
            <h1 style="font-size: 24px; letter-spacing: -0.5px; line-height: 1.3; font-weight: 400; color: #484848; margin-bottom: 30px;">
              Welcome to Alteryx, ${userName}!
            </h1>
            <p style="font-size: 16px; line-height: 26px; color: #484848; margin-bottom: 30px;">
              You're all set to redeem your New Hire Bundle. Click the button below to access your account and place your order.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" style="background-color: #007ee6; border-radius: 5px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; padding: 12px 20px;">
                Access Your Account
              </a>
            </div>
            ${userData?.orders?.[0] ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px; color: #484848;">Your Order Details:</h3>
                <p style="margin: 5px 0; color: #666;">Order Number: ${userData.orders[0].order_number}</p>
                <p style="margin: 5px 0; color: #666;">Date: ${new Date(userData.orders[0].date_submitted).toLocaleDateString()}</p>
              </div>
            ` : ''}
            <p style="font-size: 14px; line-height: 22px; color: #999; margin-top: 30px;">
              If you did not request this login, please ignore this email. This link will expire for security purposes.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              © ${new Date().getFullYear()} Whitestone Branding. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email using SMTP
    await smtpClient.send({
      from: 'Whitestone <admin@whitestonebranding.com>',
      to: user.email,
      subject: 'Welcome to Alteryx – Redeem Your New Hire Bundle',
      html: html,
    });

    console.log('Email sent successfully via SMTP to:', user.email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Auth email SMTP error:', error)
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})