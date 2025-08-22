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
            <Heading style={h1}>Your Alteryx Welcome Kit</Heading>
            <Text style={text}>Hey {customerName.split(' ')[0] || customerName}!</Text>
            <Text style={text}>
              We've officially placed your Alteryx new hire kit order—and trust us, it's got some goodies we think you'll love. 🚀
            </Text>
            <Text style={text}>
              Once it ships, we'll drop you a tracking link so you can keep an eye out.
            </Text>
            <Text style={text}>
              In the meantime, here are a few helpful links to get you set up:
            </Text>
            <Text style={linksList}>
              • <Link 
                  href="https://login.microsoftonline.com/522f39d9-303d-488f-9deb-a6d77f1eafd8/oauth2/authorize?client%5Fid=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&response%5Fmode=form%5Fpost&response%5Ftype=code%20id%5Ftoken&resource=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&scope=openid&nonce=4B05D5C228FDBC544B3A07B3D416859E9286656AC38F1FD4%2D7D9F704B0D08FD8A7A806727D0688624A8F21F41524E00C1E1E115025DCCBB5E&redirect%5Furi=https%3A%2F%2Falteryx0%2Esharepoint%2Ecom%2F%5Fforms%2Fdefault%2Easpx&state=OD0w&claims=%7B%22id%5Ftoken%22%3A%7B%22xms%5Fcc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083%2D87e0%2D41b5%2Dbb78%2D0bc43c8a8e8a&client%2Drequest%2Did=12cebda1%2D90d7%2D0000%2De5c9%2D3325bcbd167e"
                  style={linkStyle}
                >
                  Alteryx New Hire Portal
                </Link><br/>
              • <Link 
                  href="https://login.microsoftonline.com/522f39d9-303d-488f-9deb-a6d77f1eafd8/oauth2/authorize?client%5Fid=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&response%5Fmode=form%5Fpost&response%5Ftype=code%20id%5Ftoken&resource=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&scope=openid&nonce=6FB244225EEFE57F0998E23ACAF7D78CE7D2489E0263181E%2DF8BB4B3D035C56BB9248D4F803FFC6788124C148E396786E66C9595EFD1D5B17&redirect%5Furi=https%3A%2F%2Falteryx0%2Esharepoint%2Ecom%2F%5Fforms%2Fdefault%2Easpx&state=OD0w&claims=%7B%22id%5Ftoken%22%3A%7B%22xms%5Fcc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083%2D87e0%2D41b5%2Dbb78%2D0bc43c8a8e8a&client%2Drequest%2Did=22cebda1%2Db0c5%2D0000%2De5c9%2D3b08f34c2323#checklist-and-access"
                  style={linkStyle}
                >
                  First Week Checklist
                </Link>
            </Text>
            <Text style={text}>
              Welcome aboard—we're so excited you're here!
            </Text>
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
          Cheers,<br/>
          Whitestone,<br/>
          on behalf of the Global Onboarding Team
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