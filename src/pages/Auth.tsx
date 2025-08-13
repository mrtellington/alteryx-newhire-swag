import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";

const isAllowedEmail = (email: string) => /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(email.trim());

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [orderDetails, setOrderDetails] = useState<{
    orderNumber: string;
    dateSubmitted: string;
  } | null>(null);

  useEffect(() => {
    // SEO
    document.title = "Sign In | Alteryx New Hire Store";
    const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ?? (() => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
      return m as HTMLMetaElement;
    })();
    meta.setAttribute("content", "Secure magic link sign-in for Alteryx New Hire Store");
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/auth`);

    // Redirect if already logged in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) navigate("/shop", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/shop", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleMagicLink = async () => {
    if (!isAllowedEmail(email)) {
      toast({ title: "Invalid email domain", description: "Use @alteryx.com or @whitestonebranding.com" });
      return;
    }
    
    setLoading(true);
    
    // Check if user already has an order
    try {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("order_submitted")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (usersError && usersError.code !== "PGRST116") {
        console.error("Error checking user:", usersError);
        setLoading(false);
        return;
      }

      if (users?.order_submitted) {
        // Get user ID first
        const { data: userData, error: userIdError } = await supabase
          .from("users")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .single();

        if (userIdError || !userData) {
          console.error("Error getting user ID:", userIdError);
          setLoading(false);
          return;
        }

        // Get order details
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("order_number, date_submitted")
          .eq("user_id", userData.id)
          .single();

        if (ordersError) {
          console.error("Error fetching order:", ordersError);
          setLoading(false);
          return;
        } else if (orders) {
          setOrderDetails({
            orderNumber: orders.order_number,
            dateSubmitted: new Date(orders.date_submitted).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric", 
              month: "numeric",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short"
            }),
          });
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking order status:", error);
      setLoading(false);
      return;
    }

    const redirectUrl = `${window.location.origin}/shop`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Unable to send link", description: error.message });
    } else {
      toast({ title: "Check your email", description: "We sent you a secure magic link." });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Alteryx New Hire Store</CardTitle>
          <CardDescription>Sign in with a magic link</CardDescription>
        </CardHeader>
        <CardContent>
          {orderDetails ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Bundle Already Redeemed</strong>
                  <br />
                  You have already redeemed your New Hire Bundle.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="font-medium">Order Number:</span>
                  <span className="font-mono">{orderDetails.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Order Date:</span>
                  <span>{orderDetails.dateSubmitted}</span>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                variant="outline" 
                onClick={() => {
                  setOrderDetails(null);
                  setEmail("");
                }}
              >
                Check Different Email
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Company Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@alteryx.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>
              <Button className="w-full" variant="brand" onClick={handleMagicLink} disabled={loading}>
                {loading ? "Checking..." : "Send magic link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Only registered emails ending with @alteryx.com are permitted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
