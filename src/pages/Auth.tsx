import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const isAllowedEmail = (email: string) => /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(email.trim());

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

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
      toast({ title: "Invalid email domain", description: "Use @alteryx.com" });
      return;
    }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/shop`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Company Email</Label>
              <Input id="email" type="email" placeholder="you@alteryx.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="w-full" variant="brand" onClick={handleMagicLink} disabled={loading}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
            <p className="text-xs text-muted-foreground">Only emails ending with @alteryx.com are permitted.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
