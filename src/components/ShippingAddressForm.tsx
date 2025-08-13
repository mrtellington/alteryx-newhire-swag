import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMemo, useState } from "react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { getData as getCountryData } from "country-list";

const postalCodePatterns: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
};

const addressSchema = z
  .object({
    line1: z.string().min(3, "Address line 1 is required"),
    line2: z.string().optional(),
    city: z.string().min(2, "City is required"),
    region: z.string().min(2, "Region/State is required"),
    postal_code: z.string().min(2, "Postal code is required"),
    country: z.string().length(2, "Select a country"), // ISO Alpha-2 code
  })
  .superRefine((val, ctx) => {
    const pattern = postalCodePatterns[val.country];
    if (pattern && !pattern.test(val.postal_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postal_code"],
        message:
          val.country === "US"
            ? "ZIP must be 12345 or 12345-6789"
            : val.country === "CA"
            ? "Use format A1A 1A1"
            : "Invalid UK postcode format",
      });
    }
    // Basic length check for other countries
    if (!pattern && val.postal_code.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["postal_code"], message: "Postal code too short" });
    }
  });

export type AddressValues = z.infer<typeof addressSchema>;

interface ShippingAddressFormProps {
  onSuccess?: (orderId: string) => void;
}

export default function ShippingAddressForm({ onSuccess }: ShippingAddressFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const countries = useMemo(() => {
    // [{ code: 'US', name: 'United States' }, ...]
    return getCountryData().sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      line1: "",
      line2: "",
      city: "",
      region: "",
      postal_code: "",
      country: "US",
    },
  });

  const regionLabel = useMemo(() => {
    const c = form.getValues("country");
    if (c === "US") return "State";
    if (c === "CA") return "Province";
    if (c === "GB") return "County";
    return "Region/State";
  }, [form.watch("country")]);

  const onSubmit = async (values: AddressValues) => {
    setSubmitting(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        throw new Error(userErr?.message || "Not authenticated");
      }
      const userId = userRes.user.id;

      const { error: updateErr } = await supabase
        .from("users")
        .update({ shipping_address: values })
        .eq("id", userId);
      if (updateErr) throw updateErr;

      const { data: orderId, error: rpcErr } = await supabase.rpc("place_order");
      if (rpcErr) throw rpcErr;

      toast({ title: "Order placed!", description: "Your claim was successful." });
      onSuccess?.(orderId as unknown as string);
      form.reset();
    } catch (e: any) {
      const msg = e?.message || "Something went wrong";
      toast({ title: "Unable to place order", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="line1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address line 1</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="line2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address line 2</FormLabel>
              <FormControl>
                <Input placeholder="Apt, suite, etc. (optional)" {...field} />
              </FormControl>
              <FormDescription>Optional</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{regionLabel}</FormLabel>
                <FormControl>
                  <Input placeholder={regionLabel} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input placeholder="Postal Code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Submitting..." : "Confirm and Claim"}
        </Button>
      </form>
    </Form>
  );
}
