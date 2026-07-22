import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart } from "@/components/cart-provider";
import { useSession } from "@/hooks/use-auth";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

type ProductMeta = {
  id: string;
  tax_rate_id: string | null;
  price_includes_tax: boolean;
  fee_category_id: string | null;
  tax_rates: { id: string; rate_percent: number; name: string } | null;
  fee_categories:
    | {
        id: string;
        name: string;
        amount_cents: number;
        percent: number;
        scope: "per_unit" | "per_order";
        taxable: boolean;
        tax_rate_id: string | null;
      }
    | null;
};

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { user, loading } = useSession();
  const { data: settings } = useSiteSettingsOptional();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const currency = settings?.currency ?? "INR";

  const productIds = useMemo(() => Array.from(new Set(items.map((i) => i.product_id))), [items]);

  const { data: productMeta } = useQuery({
    queryKey: ["checkout-product-meta", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, tax_rate_id, price_includes_tax, fee_category_id, tax_rates:tax_rate_id(id, name, rate_percent), fee_categories:fee_category_id(id, name, amount_cents, percent, scope, taxable, tax_rate_id)",
        )
        .in("id", productIds);
      if (error) throw error;
      return (data ?? []) as unknown as ProductMeta[];
    },
  });

  const [form, setForm] = useState({
    full_name: "", email: user?.email ?? "",
    line1: "", line2: "", city: "", region: "", postal_code: "", country: "", phone: "",
  });
  useEffect(() => {
    if (user?.email && !form.email) setForm((f) => ({ ...f, email: user.email! }));
  }, [user]);
  const upd = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: shippingOptions } = useQuery({
    queryKey: ["checkout-shipping", form.country?.toUpperCase()],
    queryFn: async () => {
      const country = form.country?.trim().toUpperCase();
      if (!country) return [] as { id: string; name: string; price_cents: number; free_over_cents: number | null }[];
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("id, countries, is_active, shipping_rates(id, name, price_cents, free_over_cents, is_active)")
        .eq("is_active", true);
      if (error) throw error;
      const matched = (data ?? []).filter((z: any) => (z.countries ?? []).map((c: string) => c.toUpperCase()).includes(country));
      return matched.flatMap((z: any) => (z.shipping_rates ?? []).filter((r: any) => r.is_active)) as any[];
    },
  });

  const [selectedShippingId, setSelectedShippingId] = useState<string>("");
  useEffect(() => {
    if (shippingOptions && shippingOptions.length && !shippingOptions.find((r) => r.id === selectedShippingId)) {
      setSelectedShippingId(shippingOptions[0].id);
    }
    if (shippingOptions && shippingOptions.length === 0) setSelectedShippingId("");
  }, [shippingOptions]);

  // Compute totals from authoritative product data.
  const totals = useMemo(() => {
    const metaById = new Map<string, ProductMeta>();
    (productMeta ?? []).forEach((m) => metaById.set(m.id, m));

    let taxExclusive = 0; // added on top
    let taxInclusive = 0; // informational
    let feeTotal = 0;
    let feeTaxExclusive = 0;
    let feeTaxInclusive = 0;

    // per-order fees only counted once per fee_category
    const perOrderFees = new Map<string, ProductMeta["fee_categories"]>();

    for (const item of items) {
      const meta = metaById.get(item.product_id);
      const lineSubtotal = item.unit_price_cents * item.quantity;
      const taxPct = meta?.tax_rates?.rate_percent ?? 0;

      if (taxPct > 0) {
        if (meta?.price_includes_tax) {
          // tax portion inside price: price * (rate / (100 + rate))
          taxInclusive += Math.round(lineSubtotal * (taxPct / (100 + taxPct)));
        } else {
          taxExclusive += Math.round(lineSubtotal * (taxPct / 100));
        }
      }

      const fee = meta?.fee_categories;
      if (fee) {
        if (fee.scope === "per_unit") {
          const feeAmt = (fee.amount_cents ?? 0) * item.quantity + Math.round(item.unit_price_cents * item.quantity * (Number(fee.percent) || 0) / 100);
          feeTotal += feeAmt;
          if (fee.taxable) {
            const feeTaxPct = (fee.tax_rate_id ? undefined : taxPct) ?? taxPct;
            // use fee's own tax rate if configured (needs a fetch); for simplicity fall back to product tax
            const applyPct = feeTaxPct;
            if (applyPct > 0) {
              if (meta?.price_includes_tax) feeTaxInclusive += Math.round(feeAmt * (applyPct / (100 + applyPct)));
              else feeTaxExclusive += Math.round(feeAmt * (applyPct / 100));
            }
          }
        } else if (!perOrderFees.has(fee.id)) {
          perOrderFees.set(fee.id, fee);
        }
      }
    }

    for (const fee of perOrderFees.values()) {
      if (!fee) continue;
      const flat = fee.amount_cents ?? 0;
      const pctPart = Math.round(subtotal * (Number(fee.percent) || 0) / 100);
      const feeAmt = flat + pctPart;
      feeTotal += feeAmt;
      // per-order fees don't know product tax; skip taxing them unless taxable + fee has own rate → out of scope for MVP
    }

    const selected = shippingOptions?.find((r: any) => r.id === selectedShippingId);
    let shippingCents = 0;
    if (selected) {
      shippingCents = selected.free_over_cents && subtotal >= selected.free_over_cents ? 0 : (selected.price_cents ?? 0);
    }
    const totalTaxOnTop = taxExclusive + feeTaxExclusive;
    const totalInclusiveTax = taxInclusive + feeTaxInclusive;
    const total = subtotal + shippingCents + feeTotal + totalTaxOnTop;
    return {
      shippingCents,
      feeTotal,
      taxOnTop: totalTaxOnTop,
      inclusiveTax: totalInclusiveTax,
      total,
    };
  }, [items, productMeta, subtotal]);

  const placeOrder = async () => {
    if (!user) { navigate({ to: "/auth", search: { next: "/checkout" } as any }); return; }
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const { data: order, error } = await supabase.from("orders").insert({
        user_id: user.id,
        email: form.email,
        status: "pending",
        subtotal_cents: subtotal,
        shipping_cents: totals.shippingCents,
        tax_cents: totals.taxOnTop,
        fee_cents: totals.feeTotal,
        discount_cents: 0,
        total_cents: totals.total,
        currency,
        shipping_address: form,
        billing_address: form,
      }).select().single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          variant_id: i.variant_id,
          title: i.title,
          variant_name: i.variant_name,
          unit_price_cents: i.unit_price_cents,
          quantity: i.quantity,
          image_url: i.image_url,
        })),
      );
      if (itemsError) throw itemsError;

      clear();
      toast.success("Order placed! Payment will be collected when payments are enabled.");
      navigate({ to: "/account/orders/$id" as any, params: { id: order.id } as any });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto p-8 text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty.</p>
          <Button asChild><Link to="/shop">Continue shopping</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>
        {!user ? (
          <p className="mb-4 p-4 border rounded bg-muted/30">
            Please <Link to="/auth" className="underline font-medium">sign in</Link> to complete your order.
          </p>
        ) : null}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-lg">Shipping information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={upd("full_name")} required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={upd("email")} required /></div>
              <div className="md:col-span-2"><Label>Address</Label><Input value={form.line1} onChange={upd("line1")} required /></div>
              <div className="md:col-span-2"><Label>Apartment / suite</Label><Input value={form.line2} onChange={upd("line2")} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={upd("city")} required /></div>
              <div><Label>State/Region</Label><Input value={form.region} onChange={upd("region")} /></div>
              <div><Label>Postal code</Label><Input value={form.postal_code} onChange={upd("postal_code")} required /></div>
              <div><Label>Country</Label><Input value={form.country} onChange={upd("country")} required /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={upd("phone")} /></div>
            </div>
          </div>
          <aside className="p-6 border rounded-lg h-fit space-y-3">
            <h2 className="font-semibold">Order summary</h2>
            {items.map((i) => (
              <div key={`${i.product_id}:${i.variant_id}`} className="flex justify-between text-sm">
                <span>{i.title} × {i.quantity}</span>
                <span>{formatMoney(i.unit_price_cents * i.quantity, currency)}</span>
              </div>
            ))}
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(totals.shippingCents, currency)}</span></div>
              {totals.feeTotal > 0 ? (
                <div className="flex justify-between"><span>Fees</span><span>{formatMoney(totals.feeTotal, currency)}</span></div>
              ) : null}
              {totals.taxOnTop > 0 ? (
                <div className="flex justify-between"><span>Tax</span><span>{formatMoney(totals.taxOnTop, currency)}</span></div>
              ) : null}
              {totals.inclusiveTax > 0 ? (
                <div className="flex justify-between text-muted-foreground"><span>Tax (included)</span><span>{formatMoney(totals.inclusiveTax, currency)}</span></div>
              ) : null}
              <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span>{formatMoney(totals.total, currency)}</span></div>
            </div>
            <Button className="w-full" size="lg" onClick={placeOrder} disabled={submitting || !user}>
              {submitting ? "Placing…" : "Place order"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Payments will be enabled soon.</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
