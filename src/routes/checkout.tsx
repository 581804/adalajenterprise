import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProductCheckoutMeta } from "@/integrations/mongodb/product.functions";
import { listActiveShippingForCountry } from "@/integrations/mongodb/shipping-zone.functions";
import { createOrder } from "@/integrations/mongodb/order.functions";
import { previewDiscountClient } from "@/integrations/mongodb/discount.functions";
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
    queryFn: () => getProductCheckoutMeta({ data: { productIds } }),
  });

  const [form, setForm] = useState({
    full_name: "", email: user?.email ?? "",
    line1: "", line2: "", city: "", region: "", postal_code: "", country: "", phone: "",
  });
  useEffect(() => {
    if (user?.email && !form.email) setForm((f) => ({ ...f, email: user.email! }));
  }, [user]);
  const upd = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: shippingZones } = useQuery({
    queryKey: ["checkout-shipping", form.country?.trim().toUpperCase()],
    enabled: !!form.country?.trim(),
    queryFn: () => listActiveShippingForCountry({ data: { country: form.country.trim().toUpperCase() } }),
  });
  const shippingOptions = useMemo(
    () => (shippingZones ?? []).flatMap((z) => z.shipping_rates.map((r) => ({ ...r, zoneId: z.id }))),
    [shippingZones],
  );

  const [selectedShippingId, setSelectedShippingId] = useState<string>("");
  useEffect(() => {
    if (shippingOptions.length && !shippingOptions.find((r) => r.id === selectedShippingId)) {
      setSelectedShippingId(shippingOptions[0].id);
    }
    if (shippingOptions.length === 0) setSelectedShippingId("");
  }, [shippingOptions]);
  const selectedShipping = shippingOptions.find((r) => r.id === selectedShippingId);

  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<{ code: string; type: "percent" | "fixed" | "free_shipping"; discount_cents: number } | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setApplyingDiscount(true);
    try {
      const result = await previewDiscountClient({ data: { code, subtotalCents: subtotal } });
      setDiscount({ code: result.code, type: result.type, discount_cents: result.discountCents });
      toast.success(`Discount "${result.code}" applied`);
    } catch (e: any) {
      setDiscount(null);
      toast.error(e.message ?? "Could not apply discount");
    } finally {
      setApplyingDiscount(false);
    }
  };
  const removeDiscount = () => { setDiscount(null); setDiscountInput(""); };
  useEffect(() => {
    if (!discount) return;
    previewDiscountClient({ data: { code: discount.code, subtotalCents: subtotal } })
      .then((result) => setDiscount({ code: result.code, type: result.type, discount_cents: result.discountCents }))
      .catch(() => setDiscount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const totals = useMemo(() => {
    type ProductMetaItem = NonNullable<typeof productMeta>[number];
    const metaById = new Map((productMeta ?? []).map((m) => [m.id, m]));
    let taxExclusive = 0;
    let taxInclusive = 0;
    let feeTotal = 0;
    let feeTaxExclusive = 0;
    let feeTaxInclusive = 0;
    const perOrderFees = new Map<string, ProductMetaItem["fee_categories"]>();

    for (const item of items) {
      const meta = metaById.get(item.product_id);
      const lineSubtotal = item.unit_price_cents * item.quantity;
      const taxPct = meta?.tax_rates?.rate_percent ?? 0;

      if (taxPct > 0) {
        if (meta?.price_includes_tax) taxInclusive += Math.round(lineSubtotal * (taxPct / (100 + taxPct)));
        else taxExclusive += Math.round(lineSubtotal * (taxPct / 100));
      }

      const fee = meta?.fee_categories;
      if (fee) {
        if (fee.scope === "per_unit") {
          const feeAmt = (fee.amount_cents ?? 0) * item.quantity + Math.round((lineSubtotal * (Number(fee.percent) || 0)) / 100);
          feeTotal += feeAmt;
          if (fee.taxable && taxPct > 0) {
            if (meta?.price_includes_tax) feeTaxInclusive += Math.round(feeAmt * (taxPct / (100 + taxPct)));
            else feeTaxExclusive += Math.round(feeAmt * (taxPct / 100));
          }
        } else if (!perOrderFees.has(fee.id)) {
          perOrderFees.set(fee.id, fee);
        }
      }
    }
    for (const fee of perOrderFees.values()) {
      if (!fee) continue;
      feeTotal += (fee.amount_cents ?? 0) + Math.round((subtotal * (Number(fee.percent) || 0)) / 100);
    }

    let shippingCents = 0;
    if (selectedShipping) {
      shippingCents = selectedShipping.free_over_cents && subtotal >= selectedShipping.free_over_cents ? 0 : selectedShipping.price_cents;
    }
    let discountCents = 0;
    if (discount) {
      if (discount.type === "free_shipping") {
        discountCents = shippingCents;
        shippingCents = 0;
      } else {
        discountCents = Math.min(discount.discount_cents, subtotal);
      }
    }
    const taxOnTop = taxExclusive + feeTaxExclusive;
    const inclusiveTax = taxInclusive + feeTaxInclusive;
    const total = Math.max(0, subtotal - discountCents + shippingCents + feeTotal + taxOnTop);
    return { shippingCents, feeTotal, taxOnTop, inclusiveTax, discountCents, total };
  }, [items, productMeta, subtotal, selectedShipping, discount]);

  const placeOrder = async () => {
    if (!user) { navigate({ to: "/auth", search: { next: "/checkout" } as any }); return; }
    if (items.length === 0) return;

    const requiredFields: Array<[keyof typeof form, string]> = [
      ["full_name", "Full name"], ["email", "Email"], ["line1", "Address"], ["line2", "Apartment / suite"],
      ["city", "City"], ["region", "State/Region"], ["postal_code", "Postal code"], ["country", "Country"], ["phone", "Phone"],
    ];
    for (const [key, label] of requiredFields) {
      if (!String(form[key] ?? "").trim()) { toast.error(`${label} is required`); return; }
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        data: {
          items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity })),
          email: form.email,
          shippingAddress: {
            full_name: form.full_name, line1: form.line1, line2: form.line2, city: form.city,
            region: form.region, postal_code: form.postal_code, country: form.country, phone: form.phone,
          },
          shippingZoneId: selectedShipping?.zoneId ?? null,
          shippingRateId: selectedShipping?.id ?? null,
          discountCode: discount?.code ?? null,
        },
      });

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
              <div><Label>Full name *</Label><Input value={form.full_name} onChange={upd("full_name")} required /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={upd("email")} required /></div>
              <div className="md:col-span-2"><Label>Address *</Label><Input value={form.line1} onChange={upd("line1")} required /></div>
              <div className="md:col-span-2"><Label>Apartment / suite *</Label><Input value={form.line2} onChange={upd("line2")} required /></div>
              <div><Label>City *</Label><Input value={form.city} onChange={upd("city")} required /></div>
              <div><Label>State/Region *</Label><Input value={form.region} onChange={upd("region")} required /></div>
              <div><Label>Postal code *</Label><Input value={form.postal_code} onChange={upd("postal_code")} required /></div>
              <div><Label>Country *</Label><Input value={form.country} onChange={upd("country")} required /></div>
              <div><Label>Phone *</Label><Input value={form.phone} onChange={upd("phone")} required /></div>
            </div>

            {form.country ? (
              <div className="pt-4">
                <h2 className="font-semibold text-lg mb-2">Shipping method</h2>
                {shippingOptions.length > 0 ? (
                  <div className="space-y-2">
                    {shippingOptions.map((r) => {
                      const free = r.free_over_cents && subtotal >= r.free_over_cents;
                      return (
                        <label key={r.id} className={`flex items-center justify-between border rounded p-3 cursor-pointer ${selectedShippingId === r.id ? "border-primary bg-muted/30" : ""}`}>
                          <span className="flex items-center gap-2">
                            <input type="radio" name="ship" checked={selectedShippingId === r.id} onChange={() => setSelectedShippingId(r.id)} />
                            <span>{r.name}</span>
                          </span>
                          <span className="text-sm font-medium">{free ? "Free" : formatMoney(r.price_cents, currency)}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No shipping options configured for {form.country.toUpperCase()}. Order will ship with no shipping fee — contact us for arrangements.</p>
                )}
              </div>
            ) : null}
          </div>
          <aside className="p-6 border rounded-lg h-fit space-y-3">
            <h2 className="font-semibold">Order summary</h2>
            {items.map((i) => (
              <div key={`${i.product_id}:${i.variant_id}`} className="flex justify-between text-sm">
                <span>{i.title} × {i.quantity}</span>
                <span>{formatMoney(i.unit_price_cents * i.quantity, currency)}</span>
              </div>
            ))}
            <div className="border-t pt-3 space-y-2">
              {discount ? (
                <div className="flex items-center justify-between text-sm bg-muted/40 rounded p-2">
                  <span>Code <strong>{discount.code}</strong> applied</span>
                  <Button type="button" variant="ghost" size="sm" onClick={removeDiscount}>Remove</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Discount code"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyDiscount(); } }}
                  />
                  <Button type="button" variant="secondary" onClick={applyDiscount} disabled={applyingDiscount || !discountInput.trim()}>
                    {applyingDiscount ? "…" : "Apply"}
                  </Button>
                </div>
              )}
            </div>
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
              {totals.discountCents > 0 ? (
                <div className="flex justify-between text-primary"><span>Discount{discount ? ` (${discount.code})` : ""}</span><span>-{formatMoney(totals.discountCents, currency)}</span></div>
              ) : null}
              {totals.shippingCents > 0 ? (
                <div className="flex justify-between"><span>Shipping{selectedShipping ? ` (${selectedShipping.name})` : ""}</span><span>{formatMoney(totals.shippingCents, currency)}</span></div>
              ) : selectedShipping ? (
                <div className="flex justify-between"><span>Shipping ({selectedShipping.name})</span><span>Free</span></div>
              ) : null}
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
