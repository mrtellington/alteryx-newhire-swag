import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // SEO
    document.title = "Alteryx New Hire Store | Home";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Alteryx New Hire Store home page for approved employees");

    // Set up auth listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        setEmail(session.user.email ?? null);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        setEmail(session.user.email ?? null);
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
