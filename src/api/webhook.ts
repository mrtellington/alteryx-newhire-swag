import { supabase } from '../lib/supabase';
import { CognitoFormSubmission } from '../lib/supabase';

export const handleCognitoFormWebhook = async (req: any, res: any) => {
  // Verify the request is from Cognito Forms (you may want to add additional validation)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData: CognitoFormSubmission = req.body;

    // Validate required fields
    if (!formData.email || !formData.full_name || !formData.address_line_1 || 
        !formData.city || !formData.state || !formData.zip_code || !formData.country) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'full_name', 'address_line_1', 'city', 'state', 'zip_code', 'country']
      });
    }

    // Validate email domain - allow @alteryx.com and @whitestonebranding.com
    const allowedDomains = ['@alteryx.com', '@whitestonebranding.com'];
    const isAllowedEmail = allowedDomains.some(domain => formData.email.endsWith(domain));
    
    if (!isAllowedEmail) {
      return res.status(400).json({ 
        error: 'Only @alteryx.com email addresses are allowed' 
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', formData.email)
      .single();

    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Create new user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([
        {
          email: formData.email,
          full_name: formData.full_name,
          invited: true,
          order_submitted: false,
          shipping_address: {
            address_line_1: formData.address_line_1,
            address_line_2: formData.address_line_2 || '',
            city: formData.city,
            state: formData.state,
            zip_code: formData.zip_code,
            country: formData.country,
          },
        }
      ])
      .select()
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      return res.status(500).json({ 
        error: 'Failed to create user',
        details: userError.message 
      });
    }

    // Send confirmation email from admin@whitestonebranding.com
    await sendWelcomeEmail(formData.email, formData.full_name);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user_id: newUser.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to send welcome email from admin@whitestonebranding.com
const sendWelcomeEmail = async (email: string, fullName: string) => {
  // Implementation for sending email from admin@whitestonebranding.com
  // This would typically use a service like SendGrid, AWS SES, or similar
  console.log(`Welcome email sent from admin@whitestonebranding.com to ${email} for ${fullName}`);
  
  // Example implementation structure:
  // const emailData = {
  //   from: 'admin@whitestonebranding.com',
  //   to: email,
  //   subject: 'Welcome to Alteryx Swag Portal',
  //   html: `<p>Hi ${fullName},</p><p>Welcome to the Alteryx Swag Portal!</p>`
  // };
  // await emailService.send(emailData);
};
