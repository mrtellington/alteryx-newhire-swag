import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";

const isAllowedEmail = (email: string) => /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(email.trim());

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    document.title = "Alteryx New Hire Store | Sign In";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Sign in to the Alteryx New Hire Store with your company email");

    // Redirect if already logged in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) navigate("/", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async () => {
    if (!isAllowedEmail(email)) {
      toast({ title: "Invalid email domain", description: "Use @alteryx.com or @whitestonebranding.com" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleSignUp = async () => {
    if (!isAllowedEmail(email)) {
      toast({ title: "Invalid email domain", description: "Use @alteryx.com or @whitestonebranding.com" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters" });
      return;
    }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message });
    } else {
      toast({ title: "Check your email", description: "Confirm your address to complete sign up" });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Alteryx New Hire Store</CardTitle>
          <CardDescription>Sign in with your company email</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Company Email</Label>
                <Input id="email" type="email" placeholder="you@alteryx.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleSignIn} disabled={loading}>Sign In</Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email2">Company Email</Label>
                <Input id="email2" type="email" placeholder="you@alteryx.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2">Password</Label>
                <Input id="password2" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button className="w-full" variant="secondary" onClick={handleSignUp} disabled={loading}>Create Account</Button>
            </TabsContent>
          </Tabs>
          <p className="mt-4 text-xs text-muted-foreground">Only @alteryx.com and @whitestonebranding.com emails are allowed.</p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
