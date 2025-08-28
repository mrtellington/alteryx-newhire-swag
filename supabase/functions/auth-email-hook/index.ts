import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { AdminMagicLinkEmail } from './_templates/admin-magic-link.tsx'
import { ViewOnlyAdminMagicLinkEmail } from './_templates/view-only-admin-magic-link.tsx'
import { StandardUserMagicLinkEmail } from './_templates/standard-user-magic-link.tsx'

// Environment variables with validation
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Validate environment variables
const hasRequiredEnvVars = !!(resendApiKey && hookSecret && supabaseUrl && supabaseServiceKey)
const envDebugInfo = {
  hasResendApiKey: !!resendApiKey,
  hasHookSecret: !!hookSecret,
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseServiceKey: !!supabaseServiceKey
}

console.log('Environment variables status:', envDebugInfo)

if (!hasRequiredEnvVars) {
  console.error('Missing environment variables:', envDebugInfo)
}

// Initialize services only if env vars are available
const resend = resendApiKey ? new Resend(resendApiKey) : null
const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null

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
    // Early return with success if required environment variables are missing
    // This allows Supabase's default email functionality to work as fallback
    if (!hasRequiredEnvVars) {
      console.error('Missing required environment variables')
      throw new Error('Missing required environment variables')
    }

    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    
    console.log('Received webhook payload length:', payload.length)
    console.log('Headers:', Array.from(req.headers.keys()))
    
    // Validate webhook with proper error handling
    if (!hookSecret) {
      throw new Error('AUTH_EMAIL_HOOK_SECRET not configured')
    }
    
    let webhookData
    try {
      const wh = new Webhook(hookSecret)
      webhookData = wh.verify(payload, headers) as {
        user: { email: string }
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
    } catch (webhookError) {
      console.log('Webhook verification failed:', webhookError)
      throw new Error('Invalid webhook signature')
    }
    
    const { user, email_data: { token, token_hash, redirect_to, email_action_type } } = webhookData

    console.log('Auth email hook triggered for:', user.email, 'Action:', email_action_type);

    // Validate required services are available
    if (!supabase || !resend) {
      throw new Error('Required services not available - missing environment variables')
    }

    // Check if user is an active admin and get their role
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email, active, role')
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

    // Check if user is a secure readonly admin
    const { data: secureReadonlyAdmin } = await supabase
      .from('secure_readonly_admins')
      .select('email, active')
      .eq('email', user.email)
      .eq('active', true)
      .single();

    const isActiveAdmin = !!adminUser;
    const isEligibleUser = !!regularUser;
    const isSecureReadonlyAdmin = !!secureReadonlyAdmin;
    
    // DEBUG: Log all the values to help diagnose the routing issue
    console.log('=== EMAIL ROUTING DEBUG ===');
    console.log('Email being processed:', user.email);
    console.log('adminUser query result:', adminUser);
    console.log('regularUser query result:', regularUser);
    console.log('secureReadonlyAdmin query result:', secureReadonlyAdmin);
    console.log('isActiveAdmin:', isActiveAdmin);
    console.log('isSecureReadonlyAdmin:', isSecureReadonlyAdmin);
    console.log('isEligibleUser:', isEligibleUser);
    console.log('email_action_type:', email_action_type);
    console.log('=== END DEBUG ===');
    
    console.log('Auth check for', user.email, '- isActiveAdmin:', isActiveAdmin, 'isEligibleUser:', isEligibleUser, 'isSecureReadonlyAdmin:', isSecureReadonlyAdmin);
    
    // CRITICAL: Only allow magic links for active admins OR eligible users who haven't ordered OR secure readonly admins
    if (!isActiveAdmin && !isEligibleUser && !isSecureReadonlyAdmin) {
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

    // Send custom emails based on user type (all magic link emails)
    if (email_action_type === 'magiclink') {
      let html: string;
      let subject: string;
      let userType: string;

      if (isActiveAdmin) {
        // Admin user - check role for appropriate template (HIGHEST PRIORITY)
        const adminRole = adminUser?.role;
        const isFullAdmin = adminRole === 'admin';
        const isViewOnlyAdmin = adminRole === 'view_only';
        
        console.log('Sending custom admin magic link email to:', user.email, 'Role:', adminRole);
        
        if (isFullAdmin) {
          // Full admin template
          html = await renderAsync(
            React.createElement(AdminMagicLinkEmail, {
              supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
              token,
              token_hash,
              redirect_to,
              email_action_type,
            })
          );
          subject = 'Full Admin Access - Magic Link';
          userType = 'full_admin';
        } else if (isViewOnlyAdmin) {
          // View-only admin template
          html = await renderAsync(
            React.createElement(ViewOnlyAdminMagicLinkEmail, {
              supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
              token,
              token_hash,
              redirect_to,
              email_action_type,
            })
          );
          subject = 'View-Only Admin Access - Magic Link';
          userType = 'view_only_admin';
        } else {
          // Fallback to full admin template if role is unclear
          html = await renderAsync(
            React.createElement(AdminMagicLinkEmail, {
              supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
              token,
              token_hash,
              redirect_to,
              email_action_type,
            })
          );
          subject = 'Admin Access - Magic Link';
          userType = 'admin_fallback';
        }
      } else if (isSecureReadonlyAdmin) {
        // Secure readonly admin - use view-only template (SECOND PRIORITY)
        console.log('Sending view-only admin magic link email to secure readonly admin:', user.email);
        
        html = await renderAsync(
          React.createElement(ViewOnlyAdminMagicLinkEmail, {
            supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
            token,
            token_hash,
            redirect_to,
            email_action_type,
          })
        );
        subject = 'View-Only Admin Access - Magic Link';
        userType = 'secure_readonly_admin';
      } else if (isEligibleUser) {
        // Standard user - send new hire bundle email (LOWEST PRIORITY)
        console.log('Sending custom standard user magic link email to:', user.email);
        
        html = await renderAsync(
          React.createElement(StandardUserMagicLinkEmail, {
            supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
            token,
            token_hash,
            redirect_to,
            email_action_type,
          })
        );
        subject = 'Welcome to Alteryx - Redeem Your New Hire Bundle';
        userType = 'standard_user';
      } else {
        // This should never be reached due to the earlier check
        throw new Error(`Unexpected auth state for user: ${user.email}`);
      }

      // Send the email
      const { error } = await resend.emails.send({
        from: 'admin@whitestonebranding.com',
        to: [user.email],
        subject,
        html,
      })
      
      if (error) {
        console.error('Error sending custom magic link:', error);
        throw error
      }
      
      console.log(`${userType} magic link sent successfully to:`, user.email);
      
      return new Response(JSON.stringify({ message: 'Custom email sent', userType }), {
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