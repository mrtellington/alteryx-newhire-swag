import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ShippingAddressForm from "@/components/ShippingAddressForm";
import { toast } from "@/components/ui/use-toast";

const isAllowedEmail = (email: string) => /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(email.trim());

export default function Shop() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // SEO
    document.title = "Claim Your Gift | Alteryx New Hire Store";
    const meta = (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ?? (() => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
      return m as HTMLMetaElement;
    })();
    meta.setAttribute("content", "Claim your Alteryx new hire gift while supplies last.");
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/shop`);

    // Auth guard
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        const email = session.user.email ?? '';
        if (!isAllowedEmail(email)) {
          toast({ title: "Unauthorized email", description: "Only @alteryx.com or @whitestonebranding.com are allowed." });
          supabase.auth.signOut();
          navigate("/auth", { replace: true });
        }
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth", { replace: true });
      else if (session.user.email && !isAllowedEmail(session.user.email)) {
        toast({ title: "Unauthorized email", description: "Only @alteryx.com or @whitestonebranding.com are allowed." });
        supabase.auth.signOut();
        navigate("/auth", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const inventoryQuery = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory").select("name, sku, quantity_available").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Claim your Alteryx gift</h1>
          <p className="text-muted-foreground">One per person, while supplies last.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Featured Item</CardTitle>
            <CardDescription>Limited inventory available</CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryQuery.isLoading && <p>Loading inventory...</p>}
            {inventoryQuery.isError && (
              <p className="text-destructive">Unable to load inventory.</p>
            )}
            {inventoryQuery.data ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{inventoryQuery.data.name}</p>
                    <p className="text-sm text-muted-foreground">SKU: {inventoryQuery.data.sku}</p>
                  </div>
                  <p className="text-sm">Available: {inventoryQuery.data.quantity_available}</p>
                </div>
                <Button onClick={() => setShowForm(true)} disabled={inventoryQuery.data.quantity_available <= 0}>
                  {inventoryQuery.data.quantity_available > 0 ? "Claim your item" : "Out of stock"}
                </Button>
              </div>
            ) : (
              !inventoryQuery.isLoading && <p>No inventory configured yet.</p>
            )}
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
              <CardDescription>We’ll ship your gift here</CardDescription>
            </CardHeader>
            <CardContent>
              <ShippingAddressForm onSuccess={() => navigate("/", { replace: true })} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
