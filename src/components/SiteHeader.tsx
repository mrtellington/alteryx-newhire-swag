import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function SiteHeader() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = user?.email === "admin@whitestonebranding.com" || user?.email === "dev@whitestonebranding.com";

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="container py-4 md:py-6 flex items-center justify-between">
        <a href="/shop" aria-label="Alteryx Swag Store home">
          <img
            src="/lovable-uploads/208e6bfa-df2a-49ae-8ec6-845390b8b855.png"
            alt="Alteryx Swag Store New Hire logo"
            className="h-10 md:h-12 w-auto"
            loading="eager"
          />
        </a>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => window.location.href = "/admin"}>
              Admin
            </Button>
          )}
          {user && (
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
