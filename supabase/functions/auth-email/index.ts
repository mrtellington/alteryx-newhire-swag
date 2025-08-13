import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { MagicLinkEmail } from './_templates/magic-link.tsx'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') as string

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

    const html = await renderAsync(
      React.createElement(MagicLinkEmail, {
        supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
        token,
        token_hash,
        redirect_to,
        email_action_type,
        user_email: user.email,
        user_name: userName,
        user_order: userData?.orders?.[0] || null,
      })
    )

    const { error } = await resend.emails.send({
      from: 'Whitestone <admin@whitestonebranding.com>',
      to: [user.email],
      subject: 'Welcome to Alteryx – Redeem Your New Hire Bundle',
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Auth email error:', error)
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