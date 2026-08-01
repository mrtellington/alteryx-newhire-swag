import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface OrderConfirmationEmailProps {
  customerName: string
  orderId?: string
  teeSize?: string
  shippingAddress: string
  isAdminNotification?: boolean
  customerEmail?: string
  customerPhone?: string
}

export const OrderConfirmationEmail = ({
  customerName,
  orderId,
  teeSize,
  shippingAddress,
  isAdminNotification = false,
  customerEmail,
  customerPhone,
}: OrderConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {isAdminNotification 
        ? `New order received${orderId ? ` - ${orderId}` : ''}` 
        : '🎁 Your Alteryx Welcome Kit Is on the Way!'
      }
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {isAdminNotification ? (
          <>
            <Heading style={h1}>New Order Received</Heading>
            {orderId && (
              <Text style={text}>
                <strong>Order ID:</strong> {orderId}
              </Text>
            )}
            {teeSize && (
              <Text style={text}>
                <strong>Tee Size:</strong> {teeSize}
              </Text>
            )}
            <Text style={text}>
              <strong>Customer:</strong> {customerName} ({customerEmail})
            </Text>
            {customerPhone && (
              <Text style={text}>
                <strong>Phone:</strong> {customerPhone}
              </Text>
            )}
          </>
        ) : (
          <>
            <Heading style={h1}>Your New Hire Kit Has Been Ordered!</Heading>
            <Text style={text}>Hi {customerName.split(' ')[0] || customerName},</Text>
            <Text style={text}>Welcome to the A Team! 🎉</Text>
            <Text style={text}>
              We've officially placed your <strong>A Team Welcome Kit</strong> order, and we can't wait for it to arrive. Inside you'll find a few items to help you celebrate the start of your journey with Alteryx and show off your A Team pride.
            </Text>
            <Text style={text}>
              As soon as your kit ships, we'll send you another email with tracking information so you can follow its journey.
            </Text>
            <Text style={text}>
              While you wait, here are a few resources to help you get ready for Day 1:
            </Text>
            <Text style={linksList}>
              • <Link 
                  href="https://alteryx.service-now.com/kb_view.do?sysparm_article=KB0013524"
                  style={linkStyle}
                >
                  What Can I Expect During My Onboarding
                </Link><br/>
              • <Link 
                  href="https://alteryx.service-now.com/kb_knowledge.do?sys_id=b77ca9fd93cecf1c62293b0b6aba1008&sysparm_record_target=kb_knowledge&sysparm_record_row=8&sysparm_record_rows=8&sysparm_record_list=workflow_stateINdraft%2Creview%2Cpublished%2Cpending_retirement%2Cretired%2Coutdated%5Eauthor%3Djavascript%3Ags.getUserID%28%29%5EORrevised_by%3Djavascript%3Ags.getUserID%28%29%5EORDERBYsys_updated_on"
                  style={linkStyle}
                >
                  The Alteryx Story – Our Mission, Vision and Values
                </Link>
            </Text>
            <Text style={text}>
              We're excited to have you joining the team and can't wait to officially welcome you.
            </Text>
            <Text style={text}>See you soon!</Text>
          </>
        )}
        
        <Hr style={hr} />
        
        <Section>
          <Heading style={h2}>Shipping Address</Heading>
          <Text style={addressText} dangerouslySetInnerHTML={{ __html: shippingAddress || 'Not provided' }} />
        </Section>
        
        {!isAdminNotification && (
          <Text style={text}>
            If anything looks off, just reply to this email and we'll help.
          </Text>
        )}
        
        <Text style={footer}>
          The Global Onboarding Team<br/>
          <Link href="mailto:globalonboarding@alteryx.com" style={linkStyle}>globalonboarding@alteryx.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default OrderConfirmationEmail

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

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '20px 0 10px',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
}

const addressText = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '10px 0',
  padding: '12px',
  backgroundColor: '#f9f9f9',
  borderRadius: '4px',
}

const hr = {
  borderColor: '#e6e6e6',
  margin: '20px 0',
}

const bundleItems = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '16px 0',
  padding: '12px',
  backgroundColor: '#f5f8ff',
  borderRadius: '6px',
  borderLeft: '3px solid #2563eb',
}

const linksList = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
}

const linkStyle = {
  color: '#2563eb',
  textDecoration: 'underline',
}

const footer = {
  color: '#666',
  fontSize: '14px',
  marginTop: '30px',
  fontWeight: 'bold',
}