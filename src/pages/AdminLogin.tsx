import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, Mail } from "lucide-react";
import { 
  secureEmailSchema, 
  logEnhancedSecurityEvent, 
  RateLimiter,
  isAllowedEmailDomain,
  initializeSecureSession 
} from "@/lib/security";

// Initialize rate limiter for admin login attempts
const adminRateLimiter = new RateLimiter(3, 15 * 60 * 1000); // 3 attempts per 15 minutes

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
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
            const { data: isAdmin, error } = await supabase.rpc('is_user_admin', {
              user_email: session.user.email
            });
            
            console.log('Admin check result:', { isAdmin, error, email: session.user.email });
            
            if (error) {
              console.error('RPC error:', error);
              toast({
                title: "Error",
                description: `Admin check failed: ${error.message}`,
                variant: "destructive"
              });
              return;
            }
            
            if (isAdmin) {
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

    if (!isAllowedEmailDomain(email)) {
      await logEnhancedSecurityEvent('admin_login_invalid_domain', { 
        email: email.substring(0, 20) + '...',
        domain: email.split('@')[1] 
      }, 'high');
      toast({
        title: "Invalid Email Domain",
        description: "Admin access requires @alteryx.com or @whitestonebranding.com email addresses.",
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
      if (showPasswordFields && password) {
        // Password login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          await logEnhancedSecurityEvent('admin_password_login_failed', { 
            email: email.substring(0, 20) + '...',
            error: error.message 
          }, 'high');
          toast({
            title: "Login Failed",
            description: "Invalid email or password.",
            variant: "destructive"
          });
        } else {
          await logEnhancedSecurityEvent('admin_password_login_success', { 
            email: email.substring(0, 20) + '...' 
          });
          // Success will be handled by auth state change
        }
      } else {
        // Magic link login
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

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address first.",
        variant: "destructive"
      });
      return;
    }

    try {
      secureEmailSchema.parse(email);
    } catch (error) {
      toast({
        title: "Invalid Email Format",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-admin-password-reset', {
        body: { email: email.trim().toLowerCase() }
      });

      if (error) {
        console.error("Error sending password reset:", error);
        toast({
          title: "Error",
          description: "Failed to send password reset email. Please try again.",
          variant: "destructive"
        });
      } else {
        await logEnhancedSecurityEvent('admin_password_reset_requested', { 
          email: email.substring(0, 20) + '...' 
        });
        toast({
          title: "Password Reset Sent",
          description: "If this email is registered as an admin, you will receive a password reset link.",
        });
        setShowPasswordReset(false);
      }
    } catch (error) {
      console.error("Exception sending password reset:", error);
      toast({
        title: "Error",
        description: "Failed to send password reset email. Please try again.",
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
                Enter your admin email to receive a secure magic link
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
                    if (showPasswordFields && password) {
                      handleAdminLogin();
                    } else if (!showPasswordFields) {
                      handleAdminLogin();
                    }
                  }
                }}
              />
            </div>

            {showPasswordFields && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || cooldownSeconds > 0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && cooldownSeconds === 0 && password) {
                      handleAdminLogin();
                    }
                  }}
                />
              </div>
            )}

            {showPasswordReset ? (
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-800">
                      Enter your email address and we'll send you a password reset link.
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handlePasswordReset} 
                    disabled={loading || cooldownSeconds > 0 || !email}
                    className="flex-1"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowPasswordReset(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  onClick={handleAdminLogin} 
                  disabled={loading || cooldownSeconds > 0 || (!showPasswordFields && !email) || (showPasswordFields && (!email || !password))}
                  className="w-full"
                >
                  {loading ? (
                    showPasswordFields ? "Signing In..." : "Sending Magic Link..."
                  ) : cooldownSeconds > 0 ? (
                    `Wait ${cooldownSeconds}s`
                  ) : showPasswordFields ? (
                    "Sign In with Password"
                  ) : (
                    "Send Admin Magic Link"
                  )}
                </Button>

                <div className="flex flex-col space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    disabled={loading}
                    className="w-full"
                  >
                    {showPasswordFields ? "Use Magic Link Instead" : "Use Password Instead"}
                  </Button>
                  
                  {showPasswordFields && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowPasswordReset(true)}
                      disabled={loading}
                      className="w-full text-sm"
                    >
                      Forgot Password?
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminLogin;