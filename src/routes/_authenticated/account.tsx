import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatMoney } from "@/lib/format";
import { ChevronRight, Package, Truck, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  component: Account,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-primary/10 text-primary",
  fulfilled: "bg-primary/10 text-primary",
  shipped: "bg-accent/20 text-accent-foreground",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
};

function Account() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: orders } = useQuery({
    queryKey: ["account", "orders", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("*, order_items(id, title, quantity, image_url)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    if (!orders) return [];
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const query = q.trim().toLowerCase();
    return orders.filter((o: any) => {
      const ts = new Date(o.created_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (query) {
        const hay = `${o.order_number} ${o.status} ${o.order_items?.map((i: any) => i.title).join(" ") ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [orders, q, from, to]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">My account</h1>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold">Order history</h2>
            <div className="text-sm text-muted-foreground">
              {filtered.length} of {orders?.length ?? 0} orders
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Order number, product, status"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {(q || from || to) ? (
              <Button variant="ghost" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Clear</Button>
            ) : null}
          </div>

          <div className="border rounded-lg divide-y">
            {filtered.length ? filtered.map((o: any) => {
              const items = o.order_items ?? [];
              const totalQty = items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0);
              const preview = items.slice(0, 3);
              const extra = items.length - preview.length;
              const hasTracking = !!(o.tracking_number || o.tracking_url);
              return (
                <Link
                  key={o.id}
                  to="/account/orders/$id"
                  params={{ id: o.id }}
                  className="p-4 flex items-center gap-4 hover:bg-muted/40 transition"
                >
                  <div className="flex -space-x-2 shrink-0">
                    {preview.length ? preview.map((i: any) => (
                      i.image_url ? (
                        <img key={i.id} src={i.image_url} alt="" className="h-12 w-12 rounded border bg-background object-cover" />
                      ) : (
                        <div key={i.id} className="h-12 w-12 rounded border bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                      )
                    )) : (
                      <div className="h-12 w-12 rounded border bg-muted" />
                    )}
                    {extra > 0 ? (
                      <div className="h-12 w-12 rounded border bg-muted text-xs font-medium flex items-center justify-center">+{extra}</div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[o.status] ?? "bg-muted"}`}>{o.status}</span>
                      {hasTracking ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Truck className="h-3 w-3" />Tracking</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(o.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} · {totalQty} item{totalQty === 1 ? "" : "s"}
                    </div>
                    {preview.length ? (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {preview.map((i: any) => i.title).join(", ")}{extra > 0 ? `, +${extra} more` : ""}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">{formatMoney(o.total_cents, o.currency)}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground inline-block mt-1" />
                  </div>
                </Link>
              );
            }) : (
              <p className="p-8 text-center text-muted-foreground">
                {orders?.length ? "No orders match your filters." : "No orders yet."}
              </p>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
