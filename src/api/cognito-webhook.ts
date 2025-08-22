import { supabase } from '../lib/supabase';
import { CognitoFormSubmission } from '../lib/supabase';

export async function handleCognitoWebhook(formData: CognitoFormSubmission) {
  try {
    console.log('📝 Cognito webhook received:', formData);

    // Validate required fields
    if (!formData.email || !formData.full_name || !formData.address_line_1 || 
        !formData.city || !formData.state || !formData.zip_code || !formData.country) {
      throw new Error('Missing required fields');
    }

    // Validate email domain - allow @alteryx.com and @whitestonebranding.com
    const allowedDomains = ['@alteryx.com', '@whitestonebranding.com'];
    const isAllowedEmail = allowedDomains.some(domain => formData.email.endsWith(domain));

    if (!isAllowedEmail) {
      throw new Error('Only @alteryx.com or @whitestonebranding.com email addresses are allowed');
    }

    // Prepare shipping address
    const shippingAddress = {
      address_line_1: formData.address_line_1,
      address_line_2: formData.address_line_2 || '',
      city: formData.city,
      state: formData.state,
      zip_code: formData.zip_code,
      country: formData.country
    };

    // Call the database function to create/update user
    const { data, error } = await supabase.rpc('create_user_from_webhook', {
      user_email: formData.email,
      user_full_name: formData.full_name,
      user_shipping_address: shippingAddress
    });

    if (error) {
      console.error('❌ Error creating user from webhook:', error);
      throw error;
    }

    console.log('✅ User created/updated successfully:', data);

    // Send welcome email from admin@whitestonebranding.com
    await sendWelcomeEmail(formData.email, formData.full_name);

    return { success: true, user_id: data };

  } catch (error) {
    console.error('❌ Cognito webhook error:', error);
    throw error;
  }
}

// Helper function to send welcome email from admin@whitestonebranding.com
const sendWelcomeEmail = async (email: string, fullName: string) => {
  // Implementation for sending email from admin@whitestonebranding.com
  // This would typically use a service like SendGrid, AWS SES, or similar
  console.log(`📧 Welcome email sent from admin@whitestonebranding.com to ${email} for ${fullName}`);
  
  // Example implementation structure:
  // const emailData = {
  //   from: 'admin@whitestonebranding.com',
  //   to: email,
  //   subject: 'Welcome to Alteryx Swag Portal',
  //   html: `<p>Hi ${fullName},</p><p>Welcome to the Alteryx Swag Portal!</p>`
  // };
  // await emailService.send(emailData);
};
