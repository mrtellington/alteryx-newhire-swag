import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface StandardUserMagicLinkEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const StandardUserMagicLinkEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: StandardUserMagicLinkEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Alteryx - Redeem Your New Hire Bundle</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Alteryx! 🎉</Heading>
        <Text style={text}>
          Congratulations on joining the Alteryx team! We're excited to have you aboard.
        </Text>
        <Text style={text}>
          As part of your new hire welcome package, you have access to an exclusive bundle 
          of Alteryx swag and goodies. Click the link below to redeem your items and 
          complete your onboarding experience.
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={{
            ...link,
            display: 'block',
            marginBottom: '16px',
            backgroundColor: '#007acc',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            textAlign: 'center' as const,
            fontWeight: 'bold',
          }}
        >
          Redeem Your New Hire Bundle
        </Link>
        <Text style={{ ...text, marginBottom: '14px' }}>
          Or, copy and paste this temporary access code:
        </Text>
        <code style={code}>{token}</code>
        <Text style={text}>
          Your bundle includes exclusive Alteryx merchandise and welcome materials 
          to help you get started on your journey with us.
        </Text>
        <Text
          style={{
            ...text,
            color: '#ababab',
            marginTop: '14px',
            marginBottom: '16px',
          }}
        >
          If you didn't request access to your new hire bundle, you can safely ignore this email.
        </Text>
        <Text style={footer}>
          Welcome to the team!<br />
          <Link
            href="https://alteryx.com"
            target="_blank"
            style={{ ...link, color: '#898989' }}
          >
            The Alteryx Team
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default StandardUserMagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
}

const h1 = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const link = {
  color: '#2754C5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  textDecoration: 'underline',
}

const text = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
}

const footer = {
  color: '#898989',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '12px',
  lineHeight: '22px',
  marginTop: '12px',
  marginBottom: '24px',
}

const code = {
  display: 'inline-block',
  padding: '16px 4.5%',
  width: '90.5%',
  backgroundColor: '#f4f4f4',
  borderRadius: '5px',
  border: '1px solid #eee',
  color: '#333',
}