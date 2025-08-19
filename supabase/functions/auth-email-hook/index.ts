import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { AdminMagicLinkEmail } from './_templates/admin-magic-link.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') as string

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Check if user exists in our database (either as admin or regular user)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email, active')
      .eq('email', user.email)
      .single();

    const { data: regularUser } = await supabase
      .from('users')
      .select('email, invited')
      .eq('email', user.email)
      .single();

    const isAuthorizedUser = (adminUser?.active) || (regularUser?.invited);
    
    if (!isAuthorizedUser) {
      console.log('Unauthorized email attempted:', user.email);
      
      // Disable the user account in auth if it exists
      try {
        const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserByEmail(user.email);
        if (authUser?.user && !getUserError) {
          console.log('Disabling unauthorized user account:', user.email);
          await supabase.auth.admin.updateUserById(authUser.user.id, {
            user_metadata: { disabled: true, reason: 'Not in authorized user database' }
          });
        }
      } catch (error) {
        console.error('Error disabling user:', error);
      }
      
      // Return error to block the email
      return new Response(JSON.stringify({ 
        error: {
          http_code: 403,
          message: 'User not found in authorized user database'
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Only customize emails for admin access (magic link to /admin path)
    const isAdminLogin = redirect_to?.includes('/admin') || redirect_to?.includes('admin');
    const isAdminUser = adminUser?.active;

    if (isAdminLogin && isAdminUser && email_action_type === 'magiclink') {
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