import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
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

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { user, loading } = useSession();
  const { data: settings } = useSiteSettingsOptional();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const currency = settings?.currency ?? "USD";

  const [form, setForm] = useState({
    full_name: "",
    email: user?.email ?? "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "",
    phone: "",
  });

  const upd = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async () => {
    if (!user) { navigate({ to: "/auth", search: { next: "/checkout" } as any }); return; }
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const shipping_cents = subtotal >= 5000 ? 0 : 500;
      const tax_cents = Math.round(subtotal * 0.08);
      const total_cents = subtotal + shipping_cents + tax_cents;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          email: form.email,
          status: "pending",
          subtotal_cents: subtotal,
          shipping_cents,
          tax_cents,
          discount_cents: 0,
          total_cents,
          currency,
          shipping_address: form,
          billing_address: form,
        })
        .select()
        .single();
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

  const shipping_cents = subtotal >= 5000 ? 0 : 500;
  const tax_cents = Math.round(subtotal * 0.08);
  const total_cents = subtotal + shipping_cents + tax_cents;

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
              <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(shipping_cents, currency)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{formatMoney(tax_cents, currency)}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span>{formatMoney(total_cents, currency)}</span></div>
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
