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
      <Preview>Your Kit Is Shipped!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Kit Is Shipped! 🚚</Heading>
          <Text style={text}>Hi {firstName},</Text>
          <Text style={text}>
            Good news—your A Team Welcome Kit is officially on its way!
          </Text>
          <Text style={text}>You can track your shipment here:</Text>
          
          <Section style={trackingSection}>
            <Text style={text}>
              <strong>Order Number:</strong> {orderId}
            </Text>
            {shippingCarrier && (
              <Text style={text}>
                <strong>Carrier:</strong> {shippingCarrier}
              </Text>
            )}
            <Text style={text}>
              📦 <strong>Tracking:</strong>{' '}
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
            If you have any questions about your shipment, simply reply to this email and our team will be happy to help.
          </Text>

          <Text style={text}>
            While you're waiting for it to arrive, you can explore a few helpful resources:
          </Text>
          <Text style={bundleItems}>
            • <Link href="https://alteryx.service-now.com/kb_knowledge.do?sys_id=861b29fd938ecf1c62293b0b6aba1095&sysparm_record_target=kb_knowledge&sysparm_record_row=7&sysparm_record_rows=7&sysparm_record_list=workflow_stateINdraft%2Creview%2Cpublished%2Cpending_retirement%2Cretired%2Coutdated%5Eauthor%3Djavascript%3Ags.getUserID%28%29%5EORrevised_by%3Djavascript%3Ags.getUserID%28%29%5EORDERBYsys_updated_on" style={resourceLink}>What To Expect Your First 90 Days</Link><br/>
            • <Link href="https://alteryx0.sharepoint.com/:b:/s/GRP_AlteryxOrientation/IQBNB4QHhvvaQaZpkC7ZbwQwAdXTIOBR5AZMFaFnTHhGQQA?e=Ch1xUq" style={resourceLink}>First Week Checklist</Link>
          </Text>

          <Text style={text}>
            Your first day is almost here, and we're looking forward to welcoming you to the A Team!
          </Text>
          <Text style={text}>See you soon,</Text>

          <Hr style={hr} />
          
          <Section>
            <Heading style={h2}>Shipping Address</Heading>
            <Text style={addressText} dangerouslySetInnerHTML={{ __html: shippingAddress }} />
          </Section>

          <Text style={footer}>
            The Global Onboarding Team<br/>
            <Link href="mailto:globalonboarding@alteryx.com" style={resourceLink}>globalonboarding@alteryx.com</Link>
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