import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Package, Truck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OrderDetails {
  orderNumber: string;
  dateSubmitted: string;
  status: string;
  trackingNumber?: string;
  shippingCarrier?: string;
}

const OrderStatus = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const email = searchParams.get('email');

  useEffect(() => {
    // SEO
    document.title = "Order Status | Alteryx New Hire Store";
    const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ?? (() => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
      return m as HTMLMetaElement;
    })();
    meta.setAttribute("content", "Check your Alteryx New Hire Bundle order status and tracking information");
    
    if (email) {
      fetchOrderStatus();
    } else {
      setError("No email provided");
      setLoading(false);
    }
  }, [email]);

  const fetchOrderStatus = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      // Use the existing function to check order status
      const { data: userCheck, error: checkError } = await supabase
        .rpc('check_user_order_status', { 
          user_email: email.trim().toLowerCase() 
        });

      if (checkError) {
        throw new Error(checkError.message);
      }

      const result = typeof userCheck === 'object' ? userCheck : JSON.parse(userCheck as string);
      
      if (!result.has_ordered) {
        setError("No order found for this email address");
        return;
      }

      setOrderDetails({
        orderNumber: result.order_number || 'Unknown',
        dateSubmitted: result.date_submitted ? 
          new Date(result.date_submitted).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric", 
            month: "long",
            day: "numeric",
          }) : 'Unknown date',
        status: 'confirmed', // Default status for completed orders
        trackingNumber: result.tracking_number,
        shippingCarrier: result.shipping_carrier,
      });
      
    } catch (error) {
      console.error("Error fetching order status:", error);
      setError("Unable to retrieve order information");
      toast({
        title: "Error",
        description: "Unable to retrieve order information. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-blue flex flex-col items-center justify-start pt-16 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading order information...</div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-brand-blue flex flex-col items-center justify-start pt-16 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Unable to retrieve order information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Link to="/auth">
              <Button className="w-full" variant="outline">
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-blue flex flex-col items-center justify-start pt-16 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/lovable-uploads/47a14703-bd92-4198-9842-accafdefed92.png"
              alt="Alteryx New Hire Bundle contents"
              className="h-32 w-auto object-contain"
            />
          </div>
          <CardTitle>Order Status</CardTitle>
          <CardDescription>
            Your Alteryx New Hire Bundle order details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Bundle Successfully Ordered</strong>
              <br />
              Your New Hire Bundle has been confirmed and is being processed.
            </AlertDescription>
          </Alert>
          
          {orderDetails && (
            <div className="space-y-4">
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Order Number:</span>
                  <span className="font-mono text-sm">{orderDetails.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Order Date:</span>
                  <span className="text-sm">{orderDetails.dateSubmitted}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Status:</span>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="text-sm capitalize">{orderDetails.status}</span>
                  </div>
                </div>
                {orderDetails.trackingNumber && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Tracking:</span>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      <span className="font-mono text-sm">{orderDetails.trackingNumber}</span>
                    </div>
                  </div>
                )}
                {orderDetails.shippingCarrier && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Carrier:</span>
                    <span className="text-sm">{orderDetails.shippingCarrier}</span>
                  </div>
                )}
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>Your bundle will be shipped to the address on file.</p>
                <p>You will receive tracking information via email when it ships.</p>
              </div>
            </div>
          )}
          
          <Link to="/auth">
            <Button className="w-full" variant="outline">
              Check Different Email
            </Button>
          </Link>
        </CardContent>
      </Card>
      
      <footer className="mt-8 text-center">
        <div className="text-white/80 text-sm">
          <div>A branded experience by</div>
          <a 
            href="https://whitestonebranding.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block mt-2"
          >
            <img
              src="/lovable-uploads/b6850cef-d656-421e-a609-6e101ad734c0.png"
              alt="Whitestone Branding"
              className="h-6 w-auto"
            />
          </a>
        </div>
      </footer>
    </main>
  );
};

export default OrderStatus;