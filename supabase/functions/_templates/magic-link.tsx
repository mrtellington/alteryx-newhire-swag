import React from 'npm:react@18.3.1'
import { 
  Body, 
  Container, 
  Head, 
  Heading, 
  Html, 
  Link, 
  Preview, 
  Section, 
  Text 
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  supabase_url: string;
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  user_email: string;
  user_name?: string;
  user_order?: any;
}

export const MagicLinkEmail = ({
  supabase_url,
  token,
  token_hash,
  redirect_to,
  user_email,
  user_name = 'Valued Customer',
  user_order
}: MagicLinkEmailProps) => {
  const loginLink = `${redirect_to}#access_token=${token}&token_type=bearer&type=magiclink`;

  return (
    <Html>
      <Head />
      <Preview>Your Magic Login Link</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome, {user_name}!</Heading>
          <Section style={buttonContainer}>
            <Link href={loginLink} style={button}>
              Click to Log In
            </Link>
          </Section>
          <Text style={paragraph}>
            If you did not request this login, please ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif'
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px'
};

const heading = {
  fontSize: '24px',
  letterSpacing: '-0.5px',
  lineHeight: '1.3',
  fontWeight: '400',
  color: '#484848'
};

const buttonContainer = {
  padding: '20px',
  textAlign: 'center' as const
};

const button = {
  backgroundColor: '#007ee6',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px'
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px'
};

export default MagicLinkEmail;