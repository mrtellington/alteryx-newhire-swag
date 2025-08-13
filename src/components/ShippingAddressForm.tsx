import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";

const addressSchema = z.object({
  line1: z.string().min(3, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State/Region is required"),
  postal_code: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

export type AddressValues = z.infer<typeof addressSchema>;

interface ShippingAddressFormProps {
  onSuccess?: (orderId: string) => void;
}

export default function ShippingAddressForm({ onSuccess }: ShippingAddressFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "",
    },
  });

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
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State/Region</FormLabel>
                <FormControl>
                  <Input placeholder="State/Region" {...field} />
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
              <FormControl>
                <Input placeholder="Country" {...field} />
              </FormControl>
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
