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

    // Check if user is an active admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email, active')
      .eq('email', user.email)
      .eq('active', true)
      .single();

    // Check if user exists in users table and is eligible
    const { data: regularUser } = await supabase
      .from('users')
      .select('email, invited, order_submitted')
      .eq('email', user.email)
      .eq('invited', true)
      .eq('order_submitted', false)
      .single();

    const isActiveAdmin = !!adminUser;
    const isEligibleUser = !!regularUser;
    
    console.log('Auth check for', user.email, '- isActiveAdmin:', isActiveAdmin, 'isEligibleUser:', isEligibleUser);
    
    // CRITICAL: Only allow magic links for active admins OR eligible users who haven't ordered
    if (!isActiveAdmin && !isEligibleUser) {
      console.log('BLOCKING AUTH REQUEST - User not authorized:', user.email);
      
      // Try to disable any existing auth user to prevent future attempts
      try {
        const { data: authUser } = await supabase.auth.admin.getUserByEmail(user.email);
        if (authUser?.user) {
          console.log('Disabling unauthorized auth user:', user.email);
          await supabase.auth.admin.updateUserById(authUser.user.id, {
            email_confirm: false,
            user_metadata: { 
              disabled: true, 
              reason: 'Not in authorized user database or already ordered',
              blocked_at: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error('Error disabling unauthorized user:', error);
      }
      
      // Return error to block the request completely
      throw new Error(`Access denied: User ${user.email} is not authorized or has already ordered`);
    }

    const isAdminLogin = redirect_to?.includes('/admin') || redirect_to?.includes('admin');
    
    // For admin login, must be an active admin
    if (isAdminLogin && !isActiveAdmin) {
      console.log('BLOCKING ADMIN ACCESS - User not an active admin:', user.email);
      throw new Error(`Access denied: Admin privileges required for ${user.email}`);
    }

    // Send custom admin email for admin logins
    if (isAdminLogin && isActiveAdmin && email_action_type === 'magiclink') {
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
      
      return new Response(JSON.stringify({ message: 'Admin email sent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // For regular users, let Supabase handle the standard email
    if (isEligibleUser) {
      console.log('Allowing standard email for eligible user:', user.email);
      return new Response(JSON.stringify({ message: 'Email allowed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // This should never be reached, but block by default
    throw new Error(`Unexpected auth state for user: ${user.email}`);

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