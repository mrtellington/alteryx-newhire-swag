import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { 
  secureEmailSchema, 
  logSecurityEvent, 
  RateLimiter, 
  isAllowedEmailDomain,
  initializeSecureSession 
} from "@/lib/security";
import { useEnhancedSecurity } from "@/hooks/useEnhancedSecurity";

// Initialize rate limiter for magic link requests
const rateLimiter = new RateLimiter(3, 10 * 60 * 1000); // 3 attempts per 10 minutes

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const { trackLoginLocation } = useEnhancedSecurity();
  const [orderDetails, setOrderDetails] = useState<{
    orderNumber: string;
    dateSubmitted: string;
  } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    // Initialize secure session
    initializeSecureSession();
    
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

    // Redirect if already logged in and check order status
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session) {
        await logSecurityEvent('auth_session_detected', { 
          user_id: session.user.id,
          email: session.user.email 
        });
        
        // Check if user has already placed an order
        try {
          const { data: users } = await supabase
            .from("users")
            .select("order_submitted")
            .eq("auth_user_id", session.user.id)
            .single();
          
          await logSecurityEvent('auth_user_lookup_success', { 
            user_id: session.user.id,
            order_submitted: users?.order_submitted 
          });
          
          if (users?.order_submitted) {
            navigate("/thank-you", { replace: true });
          } else {
            navigate("/shop", { replace: true });
          }
        } catch (error) {
          await logSecurityEvent('auth_user_lookup_failed', { 
            user_id: session.user.id,
            error: error.message 
          });
          console.error("Error checking user order status:", error);
          navigate("/shop", { replace: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  const handleMagicLink = async () => {
    // Validate email format first
    try {
      secureEmailSchema.parse(email);
    } catch (error) {
      await logSecurityEvent('auth_invalid_email_format', { 
        email: email.substring(0, 20) + '...', 
        error: 'Invalid email format' 
      });
      toast({ title: "Invalid email format", description: "Please enter a valid email address" });
      return;
    }

    if (!isAllowedEmailDomain(email)) {
      await logSecurityEvent('auth_invalid_domain_attempt', { 
        email: email.substring(0, 20) + '...',
        domain: email.split('@')[1] 
      });
      toast({ title: "Invalid email domain", description: "Use @alteryx.com or @whitestonebranding.com" });
      return;
    }

    // Check rate limiting
    const rateCheck = rateLimiter.checkRateLimit(email);
    if (!rateCheck.allowed) {
      const remainingMinutes = Math.ceil((rateCheck.remainingTime || 0) / 60000);
      await logSecurityEvent('auth_rate_limit_exceeded', { 
        email: email.substring(0, 20) + '...',
        remainingMinutes 
      }, 'medium');
      toast({ 
        title: "Rate limit exceeded", 
        description: `Too many attempts. Please wait ${remainingMinutes} minutes.`,
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    // Check if user already has an order by email
    try {
      console.log("Checking if user exists and has ordered for email:", email.trim().toLowerCase());
      
      // Use the service role function to check order status (bypasses RLS)
      const { data: userCheck, error: checkError } = await supabase
        .rpc('check_user_order_status', { 
          user_email: email.trim().toLowerCase() 
        });

      console.log("User order check result:", { userCheck, checkError });

      if (checkError) {
        console.error("Error checking user order status:", checkError);
        // If we can't check, allow the magic link attempt
      } else if (userCheck) {
        // Parse the JSON response
        const result = typeof userCheck === 'object' ? userCheck : JSON.parse(userCheck as string);
        
        if (result.has_ordered) {
          console.log("User has already submitted an order, showing order details");
          
          setOrderDetails({
            orderNumber: result.order_number || 'Unknown',
            dateSubmitted: result.date_submitted ? 
              new Date(result.date_submitted).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric", 
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short"
              }) : 'Unknown date',
          });
          setLoading(false);
          toast({ 
            title: "Order already redeemed for this user.", 
            description: "No additional magic links will be sent.",
            variant: "destructive"
          });
          return;
        }
      }

    } catch (error) {
      console.error("Error checking order status:", error);
      // If we can't check the order status, we'll allow the magic link attempt
      // This prevents blocking legitimate users if there's a system error
    }

    console.log("Attempting to send magic link to:", email.trim().toLowerCase());
    const redirectUrl = `${window.location.origin}/shop`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    
    console.log("Supabase auth response:", { error });
    
    if (error) {
      console.error("Auth error details:", {
        message: error.message,
        status: error.status,
        name: error.name
      });
      
      if (error.message.includes("rate limit") || error.message.includes("too many") || error.status === 429) {
        setLastAttempt(Date.now());
        setCooldownSeconds(60); // 1 minute cooldown
        toast({ 
          title: "Rate limit exceeded", 
          description: "Supabase has rate limited this email. Please wait 1 minute before trying again.",
          variant: "destructive"
        });
      } else if (error.message.includes("Access denied") || 
                 error.message.includes("not authorized") || 
                 error.message.includes("not found in authorized") ||
                 error.message.includes("Database error saving new user")) {
        toast({ 
          title: "This is not a registered email", 
          description: "Only employees with valid company accounts can access this system.",
          variant: "destructive"
        });
      } else if (error.message.includes("User not found") || 
                 error.message.includes("Invalid login credentials") ||
                 error.message.includes("user_not_found") ||
                 error.message.includes("signup_disabled")) {
        // This indicates missing auth user - try to fix it automatically
        console.log('Detected missing auth user, attempting automatic fix...');
        toast({
          title: "Setting up your account...",
          description: "We're preparing your account for first-time access. This may take a moment.",
          variant: "default",
        });
        
        try {
          const { error: fixError } = await supabase.functions.invoke('fix-missing-auth-users');
          if (fixError) {
            console.error('Failed to fix auth users:', fixError);
            toast({
              title: "Setup error",
              description: "There was an issue setting up your account. Please contact support if this persists.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Account prepared",
              description: "Your account has been set up. Please try requesting the magic link again.",
              variant: "default",
            });
          }
        } catch (fixError) {
          console.error('Exception fixing auth users:', fixError);
          toast({
            title: "Setup incomplete",
            description: "Please contact support for assistance with account setup.",
            variant: "destructive",
          });
        }
      } else {
        toast({ 
          title: "Unable to send link", 
          description: `Error: ${error.message}`,
          variant: "destructive"
        });
      }
    } else {
      console.log("Magic link sent successfully");
      await logSecurityEvent('auth_magic_link_sent', { 
        email: email.substring(0, 20) + '...' 
      });
      
      // Track login location for enhanced security monitoring
      await trackLoginLocation('auth_magic_link_sent');
      
      toast({ title: "Check your email", description: "We sent you a secure magic link." });
    }
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
            Welcome to the team! To redeem your New Hire Bundle, enter your alteryx.com email, and you will receive a magic link to place your order.
          </CardDescription>
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
              <Button 
                className="w-full" 
                variant="brand" 
                onClick={handleMagicLink} 
                disabled={loading || cooldownSeconds > 0}
              >
                {loading ? "Checking..." : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : "Send magic link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Only registered emails ending with @alteryx.com are permitted.
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
