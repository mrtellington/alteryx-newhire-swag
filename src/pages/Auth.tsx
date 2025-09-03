import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { secureEmailSchema, isAllowedEmailDomain } from "@/lib/security";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [passwordSent, setPasswordSent] = useState(false);
  const [userHasOrder, setUserHasOrder] = useState(false);

  useEffect(() => {
    // SEO
    document.title = "Sign In | Alteryx New Hire Store";
    const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ?? (() => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
      return m as HTMLMetaElement;
    })();
    meta.setAttribute("content", "Sign in to access your Alteryx New Hire Bundle");
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/auth`);

    // Redirect if already logged in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session) {
        // Check if user has already placed an order
        try {
          const { data: users } = await supabase
            .from("users")
            .select("order_submitted")
            .eq("auth_user_id", session.user.id)
            .single();
          
          if (users?.order_submitted) {
            navigate("/thank-you", { replace: true });
          } else {
            navigate("/shop", { replace: true });
          }
        } catch (error) {
          console.error("Error checking user order status:", error);
          navigate("/shop", { replace: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailCheck = async () => {
    // Validate email format
    try {
      secureEmailSchema.parse(email);
    } catch (error) {
      toast({ title: "Invalid email format", description: "Please enter a valid email address" });
      return;
    }

    if (!isAllowedEmailDomain(email)) {
      toast({ title: "Invalid email domain", description: "Use @alteryx.com or @whitestonebranding.com" });
      return;
    }
    
    setLoading(true);
    
    try {
      // Check user's order status using the existing function
      const { data: userCheck, error: checkError } = await supabase
        .rpc('check_user_order_status', { 
          user_email: email.trim().toLowerCase() 
        });

      if (checkError) {
        console.error("Error checking user status:", checkError);
        toast({ 
          title: "Error", 
          description: "Unable to verify your email. Please try again.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const result = typeof userCheck === 'object' ? userCheck : JSON.parse(userCheck as string);
      
      if (result.has_ordered) {
        // User has already ordered - redirect to order status page
        navigate(`/order-status?email=${encodeURIComponent(email)}`);
      } else if (result.user_exists) {
        // User exists but hasn't ordered - send password email
        await sendPasswordEmail();
        setUserHasOrder(false);
      } else {
        // User doesn't exist
        toast({ 
          title: "Email not found", 
          description: "This email is not registered for the New Hire Bundle.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error checking email:", error);
      toast({ 
        title: "Error", 
        description: "Unable to process your request. Please try again.",
        variant: "destructive"
      });
    }
    
    setLoading(false);
  };

  const sendPasswordEmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-password-email', {
        body: { email: email.trim().toLowerCase() }
      });

      if (error) {
        console.error("Error sending password email:", error);
        toast({
          title: "Error",
          description: "Failed to send password email. Please try again.",
          variant: "destructive"
        });
        return;
      }

      setPasswordSent(true);
      toast({
        title: "Password sent!",
        description: "Check your email for your login password."
      });
    } catch (error) {
      console.error("Exception sending password email:", error);
      toast({
        title: "Error",
        description: "Failed to send password email. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePasswordLogin = async () => {
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });
      
      if (error) {
        console.error("Login error:", error);
        toast({ 
          title: "Login failed", 
          description: "Invalid email or password. Please try again.",
          variant: "destructive"
        });
      }
      // Success will be handled by the auth state change listener
    } catch (error) {
      console.error("Login exception:", error);
      toast({ 
        title: "Login error", 
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
    
    setLoading(false);
  };

  const handleBackToEmail = () => {
    setShowPasswordStep(false);
    setPasswordSent(false);
    setPassword("");
  };

  return (
    <main className="min-h-screen bg-brand-blue flex flex-col items-center justify-start pt-16 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/lovable-uploads/47a14703-bd92-4198-9842-accafdefed92.png"
              alt="Alteryx New Hire Bundle contents: tote, hat, sticker, water bottle, tee"
              className="h-32 w-auto object-contain"
            />
          </div>
          <CardTitle>Alteryx New Hire Bundle</CardTitle>
          <CardDescription>
            Welcome to the team! Enter your company email to check your New Hire Bundle status or sign in to place your order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passwordSent ? (
            <div className="space-y-4">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <h3 className="font-medium text-green-800">Password sent!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    We've sent your login password to your email. Check your inbox and use the password to sign in below.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password (from email)</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Enter the password from your email"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handlePasswordLogin()}
                  />
                </div>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    variant="brand" 
                    onClick={handlePasswordLogin} 
                    disabled={loading || !password}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    onClick={handleBackToEmail}
                    disabled={loading}
                  >
                    Back to Email
                  </Button>
                </div>
              </div>
            </div>
          ) : showPasswordStep ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Enter your password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handlePasswordLogin()}
                />
              </div>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  variant="brand" 
                  onClick={handlePasswordLogin} 
                  disabled={loading || !password}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline" 
                  onClick={handleBackToEmail}
                  disabled={loading}
                >
                  Back to Email
                </Button>
              </div>
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
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleEmailCheck()}
                />
              </div>
              <Button 
                className="w-full" 
                variant="brand" 
                onClick={handleEmailCheck} 
                disabled={loading || !email}
              >
                {loading ? "Checking..." : "Continue"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Enter your company email to check your bundle status.
              </p>
            </div>
          )}
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

export default Auth;
