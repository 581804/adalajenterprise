import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const [{ count: orders }, { count: products }, { count: customers }, { data: revenue }] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("total_cents").in("status", ["paid", "fulfilled", "shipped", "delivered"]),
      ]);
      const totalRevenue = (revenue ?? []).reduce((s, o: any) => s + (o.total_cents ?? 0), 0);
      return { orders: orders ?? 0, products: products ?? 0, customers: customers ?? 0, totalRevenue };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["admin", "recent-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Revenue" value={formatMoney(stats?.totalRevenue ?? 0)} />
        <Stat label="Orders" value={String(stats?.orders ?? 0)} />
        <Stat label="Products" value={String(stats?.products ?? 0)} />
        <Stat label="Customers" value={String(stats?.customers ?? 0)} />
      </div>
      <div>
        <h2 className="font-semibold mb-2">Recent orders</h2>
        <div className="border rounded-lg divide-y">
          {recent && recent.length ? recent.map((o) => (
            <div key={o.id} className="flex justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{o.order_number}</div>
                <div className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div>{formatMoney(o.total_cents, o.currency)}</div>
                <div className="text-muted-foreground">{o.status}</div>
              </div>
            </div>
          )) : <div className="p-6 text-center text-muted-foreground">No orders yet.</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
