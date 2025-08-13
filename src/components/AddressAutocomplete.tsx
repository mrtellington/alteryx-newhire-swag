import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

type Suggestion = { description: string; place_id: string };
export type NormalizedAddress = {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal_code: string;
  country: string; // ISO alpha-2
};

interface AddressAutocompleteProps {
  onSelect: (address: NormalizedAddress) => void;
}

export default function AddressAutocomplete({ onSelect }: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const sessiontoken = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (locked) {
      setSuggestions([]);
      return;
    }
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke("address-autocomplete", {
          body: { type: "autocomplete", input: query, sessiontoken },
        });
        if (error) throw error;
        setSuggestions((data as any)?.results ?? []);
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    // cleanup handled by resetting debounce above
  }, [query, sessiontoken, locked]);

  const handlePick = async (s: Suggestion) => {
    try {
      const { data, error } = await supabase.functions.invoke("address-autocomplete", {
        body: { type: "details", place_id: s.place_id, sessiontoken },
      });
      if (error) throw error;
      const addr = (data as any)?.address as NormalizedAddress | undefined;
      if (!addr) throw new Error("No address returned");
      setQuery(s.description);
      setSuggestions([]);
      setLocked(true);
      onSelect(addr);
    } catch (e: any) {
      toast({ title: "Address lookup failed", description: e.message || "Try entering manually" });
    }
  };

  return (
    <div className="relative">
      <Input
        placeholder="Search your address"
        value={query}
        onChange={(e) => { setLocked(false); setQuery(e.target.value); }}
        autoComplete="off"
        aria-autocomplete="list"
      />
      {suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full">
          <Card>
            <CardContent className="p-0 divide-y">
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => handlePick(s)}
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                >
                  {s.description}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      {loading && suggestions.length === 0 && query.length >= 3 && (
        <div className="mt-2 text-sm text-muted-foreground">Searching…</div>
      )}
    </div>
  );
}
