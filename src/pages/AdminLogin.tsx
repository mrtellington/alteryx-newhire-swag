import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Shield, ArrowLeft } from "lucide-react";
import { 
  secureEmailSchema, 
  logEnhancedSecurityEvent, 
  RateLimiter,
  isValidAdminEmail,
  initializeSecureSession 
} from "@/lib/security";

// Initialize rate limiter for admin login attempts
const adminRateLimiter = new RateLimiter(3, 15 * 60 * 1000); // 3 attempts per 15 minutes

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [lastAttempt, setLastAttempt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    // Initialize secure session
    initializeSecureSession();
    
    // SEO
    document.title = "Admin Login | Alteryx New Hire Store";
    const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ?? (() => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
      return m as HTMLMetaElement;
    })();
    meta.setAttribute("content", "Secure admin access for Alteryx New Hire Store administration");
    
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/admin/login`);

    // Check if already authenticated and admin
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Admin login auth state change:', event, session?.user?.email);
      
      if (session) {
        // Small delay to ensure session is fully established
        setTimeout(async () => {
          try {
            // Use the new secure readonly admin check
            const { data: isSecureAdmin, error: secureAdminError } = await supabase.rpc('is_secure_readonly_admin', {
              admin_email: session.user.email
            });
            
            // Fallback to regular admin check for system admins
            const { data: isAdmin, error } = await supabase.rpc('is_user_admin', {
              user_email: session.user.email
            });
            
            console.log('Admin check result:', { isSecureAdmin, isAdmin, secureAdminError, error, email: session.user.email });
            
            if (secureAdminError && error) {
              console.error('RPC errors:', { secureAdminError, error });
              toast({
                title: "Error",
                description: `Admin check failed: ${error.message}`,
                variant: "destructive"
              });
              return;
            }
            
            // User is admin if they're either a secure readonly admin OR a system admin
            if (isSecureAdmin || isAdmin) {
              navigate('/admin');
            } else {
              // Not an admin, sign out and show error
              await supabase.auth.signOut();
              toast({
                title: "Access Denied",
                description: "You don't have admin privileges.",
                variant: "destructive"
              });
            }
          } catch (error) {
            console.error('Error checking admin status:', error);
            toast({
              title: "Error", 
              description: "Failed to verify admin access",
              variant: "destructive"
            });
          }
        }, 1000);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Will be handled by onAuthStateChange
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Cooldown timer
  useEffect(() => {
    if (lastAttempt && cooldownSeconds > 0) {
      const timer = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [lastAttempt, cooldownSeconds]);


  const handleAdminLogin = async () => {
    // Validate email format
    try {
      secureEmailSchema.parse(email);
    } catch (error) {
      await logEnhancedSecurityEvent('admin_login_invalid_email_format', { 
        email: email.substring(0, 20) + '...' 
      });
      toast({
        title: "Invalid Email Format",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    if (!isValidAdminEmail(email)) {
      await logEnhancedSecurityEvent('admin_login_invalid_domain', { 
        email: email.substring(0, 20) + '...',
        domain: email.split('@')[1] 
      }, 'high');
      toast({
        title: "Not an authorized user",
        description: "Admin access is restricted to authorized administrators only.",
        variant: "destructive"
      });
      return;
    }

    // Check rate limiting
    const rateCheck = adminRateLimiter.checkRateLimit(email);
    if (!rateCheck.allowed) {
      const remainingMinutes = Math.ceil((rateCheck.remainingTime || 0) / 60000);
      await logEnhancedSecurityEvent('admin_login_rate_limit_exceeded', { 
        email: email.substring(0, 20) + '...',
        remainingMinutes 
      }, 'high');
      toast({
        title: "Rate Limited",
        description: `Too many admin login attempts. Please wait ${remainingMinutes} minutes.`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Just validate the email domain - the actual admin check happens after login
      // We'll check if they're an admin in the auth state change handler

      // Send magic link
      const redirectUrl = `${window.location.origin}/admin`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          setLastAttempt(Date.now());
          setCooldownSeconds(60);
          toast({
            title: "Rate Limited",
            description: "Too many attempts. Please wait before trying again.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        await logEnhancedSecurityEvent('admin_login_magic_link_sent', { 
          email: email.substring(0, 20) + '...' 
        });
        toast({
          title: "Magic Link Sent",
          description: `A secure login link has been sent to ${email}. Check your inbox and click the link to access the admin dashboard.`,
        });
        setEmail("");
      }
    } catch (error) {
      console.error('Admin login error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-brand-blue flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Back to Home Button */}
        <Button 
          variant="ghost" 
          className="mb-4 text-white hover:text-white hover:bg-white/10" 
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
              <CardDescription className="text-base">
                Secure authentication using Supabase magic links - no passwords required
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@alteryx.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || cooldownSeconds > 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && cooldownSeconds === 0) {
                    handleAdminLogin();
                  }
                }}
              />
            </div>

            <Button 
              onClick={handleAdminLogin} 
              disabled={loading || cooldownSeconds > 0}
              className="w-full"
            >
              {loading ? (
                "Sending Magic Link..."
              ) : cooldownSeconds > 0 ? (
                `Wait ${cooldownSeconds}s`
              ) : (
                "Send Admin Magic Link"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminLogin;