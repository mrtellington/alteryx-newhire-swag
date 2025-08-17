import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMemo, useState, useEffect } from "react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { getData as getCountryData } from "country-list";
import AddressAutocomplete, { NormalizedAddress } from "@/components/AddressAutocomplete";
import { 
  secureNameSchema, 
  securePhoneSchema, 
  secureAddressSchema, 
  logSecurityEvent,
  sanitizeInput,
  initializeSecureSession 
} from "@/lib/security";

const postalCodePatterns: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
};

const addressSchema = z
  .object({
    first_name: secureNameSchema,
    last_name: secureNameSchema,
    line1: secureAddressSchema,
    line2: secureAddressSchema.optional(),
    city: z.string().min(2, "City is required").max(50, "City name is too long")
      .transform(sanitizeInput),
    region: z.string().min(2, "Region/State is required").max(50, "Region name is too long")
      .transform(sanitizeInput),
    postal_code: z.string().min(2, "Postal code is required").max(20, "Postal code is too long")
      .transform(sanitizeInput),
    country: z.string().length(2, "Select a country"), // ISO Alpha-2 code
    phone: securePhoneSchema,
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
    if (!pattern && val.postal_code.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["postal_code"], message: "Postal code too short" });
    }
  });

export type AddressValues = z.infer<typeof addressSchema>;

interface ShippingAddressFormProps {
  selectedSize?: string | null;
  onSuccess?: (orderId: string) => void;
}

export default function ShippingAddressForm({ selectedSize, onSuccess }: ShippingAddressFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const countries = useMemo(() => {
    return getCountryData().sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Initialize secure session
  useEffect(() => {
    initializeSecureSession();
  }, []);

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      line1: "",
      line2: "",
      city: "",
      region: "",
      postal_code: "",
      country: "US",
      phone: "",
    },
  });

  const regionLabel = useMemo(() => {
    const c = form.getValues("country");
    if (c === "US") return "State";
    if (c === "CA") return "Province";
    if (c === "GB") return "County";
    return "Region/State";
  }, [form.watch("country")]);

  const applyAutocomplete = (addr: NormalizedAddress) => {
    console.log("Applying autocomplete address:", addr);
    form.setValue("line1", addr.line1 || "");
    form.setValue("line2", addr.line2 || "");
    form.setValue("city", addr.city || "");
    form.setValue("region", addr.region || "");
    form.setValue("postal_code", addr.postal_code || "");
    if (addr.country) {
      console.log("Setting country to:", addr.country);
      form.setValue("country", addr.country);
      // Force form to re-validate with new country
      form.trigger("postal_code");
    }
    form.clearErrors();
  };

  const onSubmit = async (values: AddressValues) => {
    setSubmitting(true);
    
    // Log form submission attempt
    await logSecurityEvent('shipping_form_submission_attempt', {
      country: values.country,
      hasPhone: Boolean(values.phone),
      sessionId: sessionStorage.getItem('session_id')
    });

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        await logSecurityEvent('shipping_form_auth_failure', { error: userErr?.message }, 'high');
        throw new Error(userErr?.message || "Not authenticated");
      }
      const userId = userRes.user.id;

      const shippingWithPhone = {
        ...values,
        phone: values.phone
      };

      const { error: updateErr } = await supabase
        .from("users")
        .update({ 
          shipping_address: shippingWithPhone,
          first_name: values.first_name,
          last_name: values.last_name,
          full_name: `${values.first_name} ${values.last_name}`
        })
        .eq("id", userId);
      if (updateErr) throw updateErr;

      const { data: orderId, error: rpcErr } = await supabase.rpc("place_order", { tee_size_param: selectedSize });
      if (rpcErr) throw rpcErr;

      const orderIdStr = orderId as unknown as string;

      // Fire-and-forget email confirmation (do not block success)
      supabase.functions
        .invoke("send-order-confirmation", { body: { orderId: orderIdStr } })
        .catch((e) => console.error("send-order-confirmation failed", e));

      await logSecurityEvent('order_placed_successfully', {
        orderId: orderIdStr,
        country: values.country,
        teeSize: selectedSize
      });
      
      toast({ title: "Order placed!", description: "Your claim was successful. A confirmation email is on its way." });
      onSuccess?.(orderIdStr);
      form.reset();
    } catch (e: any) {
      const msg = e?.message || "Something went wrong";
      
      await logSecurityEvent('order_placement_failed', {
        error: msg,
        country: values.country,
        teeSize: selectedSize
      }, 'high');
      
      toast({ title: "Unable to place order", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="space-y-2">
          <FormLabel>Search address</FormLabel>
          <AddressAutocomplete onSelect={applyAutocomplete} />
          <FormDescription>Use Google address search for accurate validation. You can edit fields below after selecting.</FormDescription>
        </div>
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
                <Select onValueChange={field.onChange} value={field.value}>
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
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., +1 555 123 4567 or +44 20 1234 5678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="brand" disabled={submitting} className="w-full">
          {submitting ? "Submitting..." : "Confirm and Claim"}
        </Button>
      </form>
    </Form>
  );
}
