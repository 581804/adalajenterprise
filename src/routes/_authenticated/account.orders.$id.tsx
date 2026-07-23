import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Check, Package, Truck, Home, Clock, X, Loader2, ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/orders/$id")({
  component: OrderDetail,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">Couldn't load order</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button asChild variant="outline"><Link to="/account">Back to account</Link></Button>
      </main>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <Button asChild variant="outline"><Link to="/account">Back to account</Link></Button>
      </main>
      <SiteFooter />
    </div>
  ),
});

const STEPS = [
  { key: "pending", label: "Placed", icon: Clock, tsKey: "created_at" },
  { key: "paid", label: "Confirmed", icon: Check, tsKey: null },
  { key: "fulfilled", label: "Packed", icon: Package, tsKey: null },
  { key: "shipped", label: "Shipped", icon: Truck, tsKey: "shipped_at" },
  { key: "delivered", label: "Delivered", icon: Home, tsKey: "delivered_at" },
] as const;

function fmtDate(v: any) {
  if (!v) return null;
  return new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function OrderDetail() {
  const { id } = Route.useParams();
  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Order not found</h1>
          <p className="text-sm text-muted-foreground">We couldn't find that order in your account.</p>
          <Button asChild variant="outline"><Link to="/account"><ArrowLeft className="h-4 w-4 mr-1" />Back to account</Link></Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const addr = (order.shipping_address ?? {}) as any;

  const copyTracking = () => {
    if (!order.tracking_number) return;
    navigator.clipboard.writeText(order.tracking_number);
    toast.success("Tracking number copied");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div>
          <Link to="/account" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to account
          </Link>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
            <div className="text-sm text-muted-foreground">Placed {fmtDate(order.created_at)}</div>
          </div>
        </div>

        {/* Status timeline with timestamps */}
        <section className="border rounded-lg p-6">
          <h2 className="font-semibold mb-6">Order status</h2>
          {cancelled ? (
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" /> <span className="capitalize">{order.status}</span>
              <span className="text-sm text-muted-foreground ml-2">{fmtDate(order.updated_at)}</span>
            </div>
          ) : (
            <>
              {/* Horizontal on md+ */}
              <ol className="hidden md:flex justify-between gap-2 relative">
                {STEPS.map((step, i) => {
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  const Icon = step.icon;
                  const ts = step.tsKey ? fmtDate((order as any)[step.tsKey]) : (done && i === currentIdx ? fmtDate(order.updated_at) : null);
                  return (
                    <li key={step.key} className="flex-1 flex flex-col items-center text-center relative">
                      {i > 0 ? (
                        <div className={`absolute top-4 right-1/2 w-full h-0.5 ${i <= currentIdx ? "bg-primary" : "bg-border"}`} />
                      ) : null}
                      <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${current ? "ring-4 ring-primary/20" : ""}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className={`mt-2 text-xs ${done ? "font-medium" : "text-muted-foreground"}`}>{step.label}</div>
                      {ts ? <div className="text-[10px] text-muted-foreground mt-0.5">{ts}</div> : null}
                    </li>
                  );
                })}
              </ol>
              {/* Vertical on mobile */}
              <ol className="md:hidden space-y-4">
                {STEPS.map((step, i) => {
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  const Icon = step.icon;
                  const ts = step.tsKey ? fmtDate((order as any)[step.tsKey]) : (done && i === currentIdx ? fmtDate(order.updated_at) : null);
                  return (
                    <li key={step.key} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${current ? "ring-4 ring-primary/20" : ""}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {i < STEPS.length - 1 ? <div className={`w-0.5 flex-1 min-h-6 ${i < currentIdx ? "bg-primary" : "bg-border"}`} /> : null}
                      </div>
                      <div className="pb-4">
                        <div className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{step.label}</div>
                        {ts ? <div className="text-xs text-muted-foreground">{ts}</div> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>

        {/* Shipping info */}
        {(order.carrier || order.tracking_number || order.tracking_url || order.shipped_at) ? (
          <section className="border rounded-lg p-6 space-y-2">
            <h2 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Shipping & tracking</h2>
            {order.carrier ? <div className="text-sm"><span className="text-muted-foreground">Carrier:</span> {order.carrier}</div> : null}
            {order.tracking_number ? (
              <div className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">Tracking #:</span> <span className="font-mono">{order.tracking_number}</span>
                <button type="button" onClick={copyTracking} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
              </div>
            ) : null}
            {order.shipped_at ? <div className="text-sm"><span className="text-muted-foreground">Shipped:</span> {fmtDate(order.shipped_at)}</div> : null}
            {order.delivered_at ? <div className="text-sm"><span className="text-muted-foreground">Delivered:</span> {fmtDate(order.delivered_at)}</div> : null}
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
        <section>
          <h2 className="font-semibold mb-3">Items</h2>
          <div className="border rounded-lg divide-y">
            {order.order_items?.map((i: any) => (
              <div key={i.id} className="p-4 flex gap-4 items-center">
                {i.image_url ? <img src={i.image_url} alt="" className="h-16 w-16 rounded object-cover" /> : <div className="h-16 w-16 rounded bg-muted flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
                <div className="flex-1">
                  <div className="font-medium">{i.title}</div>
                  {i.variant_name ? <div className="text-xs text-muted-foreground">{i.variant_name}</div> : null}
                  <div className="text-xs text-muted-foreground">Qty {i.quantity} · {formatMoney(i.unit_price_cents, order.currency)} each</div>
                </div>
                <div className="font-medium">{formatMoney(i.unit_price_cents * i.quantity, order.currency)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Totals + address */}
        <div className="grid md:grid-cols-2 gap-6">
          <section className="border rounded-lg p-6 space-y-1 text-sm">
            <h2 className="font-semibold mb-2">Summary</h2>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal_cents, order.currency)}</span></div>
            <div className="flex justify-between"><span>Shipping{order.shipping_method ? ` (${order.shipping_method})` : ""}</span><span>{formatMoney(order.shipping_cents, order.currency)}</span></div>
            {order.fee_cents > 0 ? <div className="flex justify-between"><span>Fees</span><span>{formatMoney(order.fee_cents, order.currency)}</span></div> : null}
            {order.tax_cents > 0 ? <div className="flex justify-between"><span>Tax</span><span>{formatMoney(order.tax_cents, order.currency)}</span></div> : null}
            {order.discount_cents > 0 ? <div className="flex justify-between"><span>Discount</span><span>−{formatMoney(order.discount_cents, order.currency)}</span></div> : null}
            <div className="flex justify-between font-bold pt-2 border-t"><span>Total</span><span>{formatMoney(order.total_cents, order.currency)}</span></div>
            {order.payment_status ? <div className="pt-2 text-xs text-muted-foreground">Payment: <span className="capitalize">{order.payment_status}</span></div> : null}
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
