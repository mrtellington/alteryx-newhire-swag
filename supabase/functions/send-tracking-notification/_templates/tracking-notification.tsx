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
      <Preview>🚚 Your Alteryx Kit Is On the Move!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Hi {firstName}!</Text>
          <Text style={text}>
            Your Alteryx new hire kit has officially shipped and is making its way to you! 🎉
          </Text>
          
          <Text style={text}>
            📦 <strong>Tracking Info:</strong>{' '}
            {trackingLink ? (
              <Link href={trackingLink} target="_blank" style={trackingLinkStyle}>
                {trackingNumber}
              </Link>
            ) : (
              <span style={trackingCode}>{trackingNumber}</span>
            )}
          </Text>
          
          <Text style={text}>
            If you have any issues with the shipment, just reply to this email and we've got you covered.
          </Text>
          
          <Text style={text}>
            Want to explore more while you wait?
          </Text>
          <Text style={linksList}>
            • <Link 
                href="https://login.microsoftonline.com/522f39d9-303d-488f-9deb-a6d77f1eafd8/oauth2/authorize?client%5Fid=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&response%5Fmode=form%5Fpost&response%5Ftype=code%20id%5Ftoken&resource=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&scope=openid&nonce=E501DC2101CFED7B5A188B3D4E15E4D5F3538E10ACB195A7%2D93FEA86E4A4088FA100F61027E05D93E3FFEC509945972676B1B4ECABBDC0A6D&redirect%5Furi=https%3A%2F%2Falteryx0%2Esharepoint%2Ecom%2F%5Fforms%2Fdefault%2Easpx&state=OD0w&claims=%7B%22id%5Ftoken%22%3A%7B%22xms%5Fcc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083%2D87e0%2D41b5%2Dbb78%2D0bc43c8a8e8a&client%2Drequest%2Did=bfcfbda1%2D80e9%2D0000%2De5c9%2D3d9dcb058e29"
                style={linkStyle}
              >
                New Hire FAQs
              </Link><br/>
            • <Link 
                href="https://login.microsoftonline.com/522f39d9-303d-488f-9deb-a6d77f1eafd8/oauth2/authorize?client%5Fid=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&response%5Fmode=form%5Fpost&response%5Ftype=code%20id%5Ftoken&resource=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&scope=openid&nonce=3AF55EC2C3561F84BE897BA52D01F3CA3BFE820847AD0D7B%2DEF9B3C96F35CAB04644E05D887666AB35A91571807ED5CAB5B2390D174BC5F84&redirect%5Furi=https%3A%2F%2Falteryx0%2Esharepoint%2Ecom%2F%5Fforms%2Fdefault%2Easpx&state=OD0w&claims=%7B%22id%5Ftoken%22%3A%7B%22xms%5Fcc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083%2D87e0%2D41b5%2Dbb78%2D0bc43c8a8e8a&client%2Drequest%2Did=c5cfbda1%2Dc091%2D0000%2De5c9%2D3ed7a8ead685"
                style={linkStyle}
              >
                People & Culture Hub
              </Link>
          </Text>
          
          <Text style={footer}>
            Talk soon,<br/>
            Whitestone<br/>
            on behalf of The Global Onboarding Team
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

const trackingLinkStyle = {
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