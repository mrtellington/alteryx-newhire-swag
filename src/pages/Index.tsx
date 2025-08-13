import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const isAllowedEmail = (email: string) => /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(email.trim());

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // SEO
    document.title = "Alteryx New Hire Store | Home";
    const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ?? (() => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
      return m as HTMLMetaElement;
    })();
    meta.setAttribute("content", "Alteryx New Hire Store home page for approved employees");
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/`);

    // Set up auth listener first
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        const userEmail = session.user.email ?? null;
        setEmail(userEmail);
        if (userEmail && !isAllowedEmail(userEmail)) {
          setTimeout(() => {
            toast({ title: "Unauthorized email", description: "Only @alteryx.com or @whitestonebranding.com are allowed." });
            supabase.auth.signOut();
            navigate("/auth", { replace: true });
          }, 0);
        }
      }
    });

    // Then check existing session
supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        const userEmail = session.user.email ?? null;
        setEmail(userEmail);
        if (userEmail && !isAllowedEmail(userEmail)) {
          toast({ title: "Unauthorized email", description: "Only @alteryx.com or @whitestonebranding.com are allowed." });
          supabase.auth.signOut();
          navigate("/auth", { replace: true });
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Welcome to the Alteryx New Hire Store</h1>
        <p className="text-lg text-muted-foreground">Signed in as {email}</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={handleSignOut} variant="secondary">Sign out</Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
