import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Check, Package, Truck, Home, Clock, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/orders/$id")({
  component: OrderDetail,
});

const STEPS = [
  { key: "pending", label: "Placed", icon: Clock },
  { key: "paid", label: "Confirmed", icon: Check },
  { key: "fulfilled", label: "Packed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
] as const;

function OrderDetail() {
  const { id } = Route.useParams();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  if (isLoading) return null;
  if (!order) return null;

  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const addr = (order.shipping_address ?? {}) as any;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div>
          <Link to="/account" className="text-sm text-muted-foreground hover:underline">← Back to account</Link>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
            <div className="text-sm text-muted-foreground">Placed {new Date(order.created_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Status timeline */}
        <section className="border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Status</h2>
          {cancelled ? (
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" /> <span className="capitalize">{order.status}</span>
            </div>
          ) : (
            <ol className="flex justify-between gap-2 relative">
              {STEPS.map((step, i) => {
                const done = i <= currentIdx;
                const Icon = step.icon;
                return (
                  <li key={step.key} className="flex-1 flex flex-col items-center text-center relative">
                    {i > 0 ? (
                      <div className={`absolute top-4 right-1/2 w-full h-0.5 ${i <= currentIdx ? "bg-primary" : "bg-border"}`} />
                    ) : null}
                    <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className={`mt-2 text-xs ${done ? "font-medium" : "text-muted-foreground"}`}>{step.label}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Shipping info */}
        {(order.carrier || order.tracking_number || order.tracking_url || order.shipped_at) ? (
          <section className="border rounded-lg p-6 space-y-2">
            <h2 className="font-semibold">Shipping</h2>
            {order.carrier ? <div className="text-sm"><span className="text-muted-foreground">Carrier:</span> {order.carrier}</div> : null}
            {order.tracking_number ? <div className="text-sm"><span className="text-muted-foreground">Tracking #:</span> {order.tracking_number}</div> : null}
            {order.shipped_at ? <div className="text-sm"><span className="text-muted-foreground">Shipped:</span> {new Date(order.shipped_at).toLocaleDateString()}</div> : null}
            {order.delivered_at ? <div className="text-sm"><span className="text-muted-foreground">Delivered:</span> {new Date(order.delivered_at).toLocaleDateString()}</div> : null}
            {order.tracking_url ? (
              <Button asChild size="sm" className="mt-2">
                <a href={order.tracking_url} target="_blank" rel="noreferrer">Track shipment</a>
              </Button>
            ) : null}
          </section>
        ) : null}

        {order.admin_note ? (
          <section className="border rounded-lg p-6">
            <h2 className="font-semibold mb-1">Note from us</h2>
            <p className="text-sm whitespace-pre-wrap">{order.admin_note}</p>
          </section>
        ) : null}

        {/* Items */}
        <section className="border rounded-lg divide-y">
          {order.order_items?.map((i: any) => (
            <div key={i.id} className="p-4 flex gap-4 items-center">
              {i.image_url ? <img src={i.image_url} alt="" className="h-16 w-16 rounded object-cover" /> : <div className="h-16 w-16 rounded bg-muted" />}
              <div className="flex-1">
                <div className="font-medium">{i.title}</div>
                {i.variant_name ? <div className="text-xs text-muted-foreground">{i.variant_name}</div> : null}
                <div className="text-xs text-muted-foreground">Qty {i.quantity}</div>
              </div>
              <div className="font-medium">{formatMoney(i.unit_price_cents * i.quantity, order.currency)}</div>
            </div>
          ))}
        </section>

        {/* Totals + address */}
        <div className="grid md:grid-cols-2 gap-6">
          <section className="border rounded-lg p-6 space-y-1 text-sm">
            <h2 className="font-semibold mb-2">Summary</h2>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal_cents, order.currency)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(order.shipping_cents, order.currency)}</span></div>
            {order.fee_cents > 0 ? <div className="flex justify-between"><span>Fees</span><span>{formatMoney(order.fee_cents, order.currency)}</span></div> : null}
            {order.tax_cents > 0 ? <div className="flex justify-between"><span>Tax</span><span>{formatMoney(order.tax_cents, order.currency)}</span></div> : null}
            {order.discount_cents > 0 ? <div className="flex justify-between"><span>Discount</span><span>−{formatMoney(order.discount_cents, order.currency)}</span></div> : null}
            <div className="flex justify-between font-bold pt-2 border-t"><span>Total</span><span>{formatMoney(order.total_cents, order.currency)}</span></div>
          </section>
          <section className="border rounded-lg p-6 text-sm">
            <h2 className="font-semibold mb-2">Shipping address</h2>
            <div>{addr.full_name}</div>
            <div>{addr.line1}</div>
            {addr.line2 ? <div>{addr.line2}</div> : null}
            <div>{[addr.city, addr.region, addr.postal_code].filter(Boolean).join(", ")}</div>
            <div>{addr.country}</div>
            {addr.phone ? <div className="mt-1 text-muted-foreground">{addr.phone}</div> : null}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
