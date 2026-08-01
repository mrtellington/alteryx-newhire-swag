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

interface DeliveryNotificationEmailProps {
  customerName: string
}

export const DeliveryNotificationEmail = ({ customerName }: DeliveryNotificationEmailProps) => {
  const firstName = (customerName || '').split(' ')[0] || customerName;

  return (
    <Html>
      <Head />
      <Preview>Your Alteryx Kit Has Arrived!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Kit Has Landed!</Heading>
          <Text style={text}>Hi {firstName},</Text>
          <Text style={text}>Your A Team Welcome Kit has arrived! 🎉</Text>
          <Text style={text}>
            We hope opening it gives you a little preview of what it means to be part of the A Team.
            Whether you're already wearing your new gear or flipping through your journal, we hope
            you're feeling excited for everything ahead.
          </Text>
          <Text style={text}>
            If you'd like to share the excitement, snap a photo and tag @Alteryx on LinkedIn—we love
            celebrating our newest teammates! You can find a “Welcome To The A Team” banner for
            LinkedIn{' '}
            <Link href="https://brand.alteryx.com/web/E6C9CCA8-81DF-434F-A44AF3201DB94DD2" target="_blank" style={resourceLink}>here</Link>.
          </Text>
          <Text style={text}>
            We're excited to officially welcome you and can't wait to see the impact you'll make.
          </Text>
          <Text style={text}>Welcome to the A Team!</Text>

          <Text style={footer}>
            The Global Onboarding Team<br/>
            <Link href="mailto:globalonboarding@alteryx.com" style={resourceLink}>globalonboarding@alteryx.com</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default DeliveryNotificationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
  maxWidth: '600px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
}

const resourceLink = {
  color: '#2563eb',
  textDecoration: 'underline',
  fontWeight: 'bold',
}

const footer = {
  color: '#666',
  fontSize: '14px',
  marginTop: '30px',
  fontWeight: 'bold',
}