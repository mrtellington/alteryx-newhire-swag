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

interface TrackingNotificationEmailProps {
  customerName: string
  orderId: string
  trackingNumber: string
  shippingCarrier?: string
  shippingAddress: string
  teeSize?: string
}

const generateTrackingLink = (trackingNumber: string, carrier?: string) => {
  if (!carrier) return null;
  
  const lowerCarrier = carrier.toLowerCase();
  
  if (lowerCarrier.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  } else if (lowerCarrier.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  } else if (lowerCarrier.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  }
  
  return null;
};

export const TrackingNotificationEmail = ({
  customerName,
  orderId,
  trackingNumber,
  shippingCarrier,
  shippingAddress,
  teeSize,
}: TrackingNotificationEmailProps) => {
  const trackingLink = generateTrackingLink(trackingNumber, shippingCarrier);
  const firstName = customerName.split(' ')[0] || customerName;

  return (
    <Html>
      <Head />
      <Preview>Your Alteryx New Hire Bundle has shipped!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Order Has Shipped! 📦</Heading>
          <Text style={text}>Hi {firstName},</Text>
          <Text style={text}>
            Great news! Your Alteryx New Hire Bundle is on its way to you.
          </Text>
          
          <Section style={trackingSection}>
            <Heading style={h2}>Tracking Information</Heading>
            <Text style={text}>
              <strong>Order Number:</strong> {orderId}
            </Text>
            {shippingCarrier && (
              <Text style={text}>
                <strong>Carrier:</strong> {shippingCarrier}
              </Text>
            )}
            <Text style={text}>
              <strong>Tracking Number:</strong>{' '}
              {trackingLink ? (
                <Link href={trackingLink} target="_blank" style={trackingLink}>
                  {trackingNumber}
                </Link>
              ) : (
                <span style={trackingCode}>{trackingNumber}</span>
              )}
            </Text>
          </Section>
          
          <Text style={text}>
            {trackingLink 
              ? "Click the tracking number above to see real-time updates on your package's location."
              : "You can use this tracking number to check your package status on the carrier's website."
            }
          </Text>
          
          <Hr style={hr} />
          
          <Section>
            <Heading style={h2}>What's in Your Bundle</Heading>
            <Text style={bundleItems}>
              • Alteryx branded tote bag<br/>
              • Alteryx hat<br/>
              • Alteryx stickers<br/>
              • Alteryx water bottle<br/>
              • Alteryx t-shirt{teeSize ? ` (size: ${teeSize})` : ''}
            </Text>
          </Section>
          
          <Hr style={hr} />
          
          <Section>
            <Heading style={h2}>Shipping Address</Heading>
            <Text style={addressText} dangerouslySetInnerHTML={{ __html: shippingAddress }} />
          </Section>
          
          <Text style={text}>
            If you have any questions about your shipment, just reply to this email and we'll help.
          </Text>
          
          <Text style={footer}>
            — Whitestone<br/>
            Alteryx New Hire Store
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default TrackingNotificationEmail

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

const trackingSection = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 0',
  border: '1px solid #e2e8f0',
}

const trackingLink = {
  color: '#2563eb',
  textDecoration: 'underline',
  fontWeight: 'bold',
}

const trackingCode = {
  backgroundColor: '#f1f5f9',
  padding: '4px 8px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontWeight: 'bold',
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

const footer = {
  color: '#666',
  fontSize: '14px',
  marginTop: '30px',
  fontWeight: 'bold',
}