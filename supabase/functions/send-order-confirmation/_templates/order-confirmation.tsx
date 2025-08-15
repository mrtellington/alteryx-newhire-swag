import {
  Body,
  Container,
  Head,
  Heading,
  Html,
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
        : 'Order confirmation'
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
            <Heading style={h1}>Order Confirmation</Heading>
            <Text style={text}>Hi {customerName.split(' ')[0] || customerName},</Text>
            <Text style={text}>
              Thanks for your order! We'll start preparing your New Hire Bundle right away.
            </Text>
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
          — Whitestone Branding
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

const footer = {
  color: '#666',
  fontSize: '14px',
  marginTop: '30px',
  fontWeight: 'bold',
}