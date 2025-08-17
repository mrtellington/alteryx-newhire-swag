import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { AdminMagicLinkEmail } from './_templates/admin-magic-link.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const wh = new Webhook(hookSecret)
    
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
        token_new: string
        token_hash_new: string
      }
    }

    console.log('Auth email hook triggered for:', user.email, 'Action:', email_action_type);

    // Only customize emails for admin access (magic link to /admin path)
    const isAdminLogin = redirect_to?.includes('/admin') || redirect_to?.includes('admin');
    
    // Check if this is an admin email
    const isAdminEmail = user.email === 'admin@whitestonebranding.com' || user.email === 'dev@whitestonebranding.com';
    
    if (!isAdminEmail) {
      console.log('Non-admin email attempted:', user.email);
      // Don't send any email for non-admin emails
      return new Response(JSON.stringify({ message: 'Not authorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (isAdminLogin && email_action_type === 'magiclink') {
      console.log('Sending custom admin magic link email to:', user.email);
      
      const html = await renderAsync(
        React.createElement(AdminMagicLinkEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to,
          email_action_type,
        })
      )

      const { error } = await resend.emails.send({
        from: 'admin@whitestonebranding.com',
        to: [user.email],
        subject: 'Admin Access - Magic Link',
        html,
      })
      
      if (error) {
        console.error('Error sending admin magic link:', error);
        throw error
      }
      
      console.log('Admin magic link sent successfully to:', user.email);
    } else {
      console.log('Standard email flow for:', user.email, 'Action:', email_action_type);
      // Let Supabase handle other email types normally
      return new Response(JSON.stringify({ message: 'Standard email flow' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

  } catch (error) {
    console.error('Auth email hook error:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message,
        },
      }),
      {
        status: error.code || 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }

  return new Response(JSON.stringify({ message: 'Email sent' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});