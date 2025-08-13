import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface MagicLinkEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
  user_email?: string
  user_name?: string
  user_order?: any
}

export const MagicLinkEmail = ({
  token_hash,
  supabase_url,
  email_action_type,
  redirect_to,
  user_name,
}: MagicLinkEmailProps) => {
  const displayName = user_name || 'there';
  
  return (
  <Html>
    <Head />
    <Preview>Welcome to Alteryx – Redeem Your New Hire Bundle</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Hi {displayName},</Heading>
        
        <Text style={text}>
          Welcome to the Alteryx team! 🎉
        </Text>
        
        <Text style={text}>
          Click the secure link below to log in and redeem your New Hire Bundle.
        </Text>
        
        <Section style={buttonContainer}>
          <Button
            href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
            style={button}
          >
            Access My Bundle
          </Button>
        </Section>
        
        <Text style={text}>
          This link will sign you in instantly — no password required.
        </Text>
        
        <Text style={text}>
          We're excited to help you get started in style!
        </Text>
        
        <Text style={text}>
          If you have any questions, please feel free to reply to this email.
        </Text>
        
        <Text style={signature}>
          — The Whitestone Team
        </Text>
      </Container>
    </Body>
  </Html>
  );
};

export default MagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

const signature = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '24px 0 32px 0',
  fontWeight: '500',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '32px 0 0 0',
}