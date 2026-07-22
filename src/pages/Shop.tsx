import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ShippingAddressForm from "@/components/ShippingAddressForm";
import { toast } from "@/components/ui/use-toast";
import { SessionTimeoutWarning } from "@/components/security/SessionTimeoutWarning";
import { useSessionSecurity } from "@/hooks/useSessionSecurity";
import newHireBundleImage from "@/assets/new-hire-bundle-2026-v4.png.asset.json";

const INVENTORY_ENDPOINT = "https://script.google.com/macros/s/AKfycbxSnyVlbsm68mJW3KlJejV8gPO3G-gFvB6n-PWx4MoSy1FOjXNctrVDlzehCxbL38Cx/exec?token=lYr2X7Pga33UaGkyPLwp5ytHch0M0DKdR6CdcK";

type SizeInventory = { sku: string; qty: number };
type InventoryBySize = Record<string, SizeInventory>;

const isAllowedEmail = (email: string) => {
  const emailTrimmed = email.trim().toLowerCase();
  return /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(emailTrimmed);
};

export default function Shop() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedSizeSku, setSelectedSizeSku] = useState<string | null>(null);
  const [sizeUnavailableMessage, setSizeUnavailableMessage] = useState<string | null>(null);
  const sizes = useMemo(() => ["XS","S","M","L","XL","2XL","3XL","4XL"], []);

  // Fetch size inventory from Google Apps Script endpoint
  const sizeInventoryQuery = useQuery({
    queryKey: ["size-inventory"],
    queryFn: async (): Promise<InventoryBySize> => {
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: 'GET',
        redirect: 'follow',
      });
      if (!response.ok) throw new Error("Failed to fetch inventory");
      const data = await response.json();
      const inventoryMap: InventoryBySize = {};
      if (data?.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.size) {
            inventoryMap[item.size] = { sku: item.sku || "", qty: item.qty ?? 0 };
          }
        }
      }
      return inventoryMap;
    },
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });

  const inventoryBySize = sizeInventoryQuery.data ?? {};
  const inventoryLoaded = sizeInventoryQuery.isSuccess;
  const inventoryFailed = sizeInventoryQuery.isError;

  // Check if a size is available (qty > 0 or inventory not loaded)
  const isSizeAvailable = (size: string): boolean => {
    if (inventoryFailed || !inventoryLoaded) return true; // Don't block if fetch failed
    const inv = inventoryBySize[size];
    return inv ? inv.qty > 0 : true; // If size not in response, assume available
  };

  // Check if all sizes are out of stock
  const allSizesOutOfStock = inventoryLoaded && !inventoryFailed && 
    sizes.every(s => {
      const inv = inventoryBySize[s];
      return inv && inv.qty <= 0;
    });

  // Clear selection if selected size becomes unavailable after load
  useEffect(() => {
    if (selectedSize && inventoryLoaded && !inventoryFailed) {
      if (!isSizeAvailable(selectedSize)) {
        setSelectedSize(null);
        setSelectedSizeSku(null);
        setSizeUnavailableMessage("That size is out of stock.");
      }
    }
  }, [inventoryLoaded, inventoryBySize, selectedSize, inventoryFailed]);

  // Clear unavailable message when user selects a new size
  const handleSizeSelect = (size: string) => {
    if (!isSizeAvailable(size)) return;
    setSelectedSize(size);
    setSizeUnavailableMessage(null);
    const inv = inventoryBySize[size];
    setSelectedSizeSku(inv?.sku || null);
  };

  // Initialize session security monitoring for authenticated users
  const { trackActivity } = useSessionSecurity({
    enableAutoExtend: true,
    enableActivityTracking: true,
    enableSecurityLogging: false // Less verbose for regular users
  });

  useEffect(() => {
    let mounted = true;
    
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

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (!session) {
          setTimeout(() => navigate("/auth", { replace: true }), 100);
          return;
        }
        
        const email = session.user.email ?? '';
        if (!isAllowedEmail(email)) {
          toast({ title: "Unauthorized email", description: "Only @alteryx.com emails are allowed." });
          supabase.auth.signOut();
          setTimeout(() => navigate("/auth", { replace: true }), 100);
          return;
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };

    checkAuth();

    // Auth guard
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (!session) {
        setTimeout(() => navigate("/auth", { replace: true }), 100);
      } else {
        const email = session.user.email ?? '';
        if (!isAllowedEmail(email)) {
          toast({ title: "Unauthorized email", description: "Only @alteryx.com emails are allowed." });
          supabase.auth.signOut();
          setTimeout(() => navigate("/auth", { replace: true }), 100);
          return;
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
      <SessionTimeoutWarning />
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
                  src={newHireBundleImage.url}
                  alt="Alteryx New Hire Bundle contents: tote, hat, sticker, water bottle, tee"
                  className="w-full rounded-md border object-cover"
                  loading="lazy"
                />
                  <div className="space-y-6">
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[hsl(var(--deep))]">New Hire Bundle</h1>
                    <div>
                      <p className="font-medium">Choose your tee size</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sizeInventoryQuery.isLoading ? (
                          // Loading skeleton for size buttons
                          sizes.map((s) => (
                            <div
                              key={s}
                              className="px-4 py-2 rounded-full border border-muted bg-muted animate-pulse w-12 h-9"
                            />
                          ))
                        ) : (
                          sizes.map((s) => {
                            const isUnavailable = !isSizeAvailable(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={isUnavailable}
                                className={
                                  `px-4 py-2 rounded-full border text-sm transition-colors ` +
                                  (isUnavailable
                                    ? "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-50"
                                    : selectedSize === s
                                      ? "bg-[hsl(var(--deep))] text-white border-transparent"
                                      : "bg-transparent text-[hsl(var(--deep))] border-[hsl(var(--deep))]")
                                }
                                onClick={() => handleSizeSelect(s)}
                                aria-pressed={selectedSize === s}
                                aria-label={isUnavailable ? `Size ${s} is out of stock` : `Select size ${s}`}
                              >
                                {s}
                              </button>
                            );
                          })
                        )}
                      </div>
                      {sizeUnavailableMessage && (
                        <p className="text-sm text-destructive mt-2">
                          {sizeUnavailableMessage}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="brand"
                      className="w-full py-6 text-base"
                      onClick={() => {
                        if (!selectedSize) {
                          toast({ title: "Select a size", description: "Please choose a tee size to continue." });
                        } else if (!isSizeAvailable(selectedSize)) {
                          toast({ title: "Size unavailable", description: `${selectedSize} is out of stock. Please choose another size.` });
                        } else {
                          setShowForm(true);
                        }
                      }}
                      disabled={!selectedSize || !isSizeAvailable(selectedSize) || allSizesOutOfStock || (!!inventoryQuery.data && inventoryQuery.data.quantity_available <= 0)}
                    >
                      {allSizesOutOfStock || (inventoryQuery.data && inventoryQuery.data.quantity_available <= 0) ? "Out of stock" : "Claim your bundle"}
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
              <ShippingAddressForm selectedSize={selectedSize} onSuccess={() => navigate("/thank-you", { replace: true, state: { fromSubmission: true } })} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
