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
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const sizes = useMemo(() => ["XS","S","M","L","XL","2XL","3XL","4XL"], []);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        const email = session.user.email ?? '';
        if (!isAllowedEmail(email)) {
          toast({ title: "Unauthorized email", description: "Only @alteryx.com emails are allowed." });
          supabase.auth.signOut();
          navigate("/auth", { replace: true });
          return;
        }

        // Check if user has already placed an order
        try {
          const { data: userData, error } = await supabase
            .from("users")
            .select("order_submitted")
            .eq("id", session.user.id)
            .single();

          if (!error && userData?.order_submitted) {
            navigate("/thank-you", { replace: true });
          }
        } catch (error) {
          console.error("Error checking order status:", error);
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else if (session.user.email && !isAllowedEmail(session.user.email)) {
        toast({ title: "Unauthorized email", description: "Only @alteryx.com emails are allowed." });
        supabase.auth.signOut();
        navigate("/auth", { replace: true });
      } else {
        // Check if user has already placed an order
        try {
          const { data: userData, error } = await supabase
            .from("users")
            .select("order_submitted")
            .eq("id", session.user.id)
            .single();

          if (!error && userData?.order_submitted) {
            navigate("/thank-you", { replace: true });
          }
        } catch (error) {
          console.error("Error checking order status:", error);
        }
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
      <div className="max-w-6xl mx-auto space-y-8">

        <Card className="border-0 shadow-none">
          <CardHeader className="sr-only">
            <CardTitle>New Hire Bundle</CardTitle>
            <CardDescription>
              <span className="sr-only">Bundle description</span>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>This Bundle Includes:</li>
                <li>Tote</li>
                <li>Hat</li>
                <li>Sticker</li>
                <li>Water Bottle</li>
                <li>Alteryx Tee</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryQuery.isLoading && <p>Loading inventory...</p>}
            {inventoryQuery.isError && (
              <p className="text-destructive">Unable to load inventory.</p>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                <img
                  src="/lovable-uploads/47a14703-bd92-4198-9842-accafdefed92.png"
                  alt="Alteryx New Hire Bundle contents: tote, hat, sticker, water bottle, tee"
                  className="w-full rounded-md border object-cover"
                  loading="lazy"
                />
                  <div className="space-y-6">
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[hsl(var(--deep))]">New Hire Bundle</h1>
                    <div>
                      <p className="font-medium">Choose your tee size</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sizes.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={
                              `px-4 py-2 rounded-full border text-sm transition-colors ` +
                              (selectedSize === s
                                ? "bg-[hsl(var(--deep))] text-white border-transparent"
                                : "bg-transparent text-[hsl(var(--deep))] border-[hsl(var(--deep))]")
                            }
                            onClick={() => setSelectedSize(s)}
                            aria-pressed={selectedSize === s}
                            aria-label={`Select size ${s}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="brand"
                      className="w-full py-6 text-base"
                      onClick={() => selectedSize ? setShowForm(true) : toast({ title: "Select a size", description: "Please choose a tee size to continue." })}
                      disabled={!selectedSize || (!!inventoryQuery.data && inventoryQuery.data.quantity_available <= 0)}
                    >
                      {inventoryQuery.data && inventoryQuery.data.quantity_available <= 0 ? "Out of stock" : "Claim your bundle"}
                    </Button>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">This Bundle Includes:</p>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground">
                        <li>Tote</li>
                        <li>Hat</li>
                        <li>Sticker</li>
                        <li>Water Bottle</li>
                        <li>Alteryx Tee</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
              <CardDescription>We’ll ship your gift here</CardDescription>
            </CardHeader>
            <CardContent>
              <ShippingAddressForm onSuccess={() => navigate("/thank-you", { replace: true })} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
