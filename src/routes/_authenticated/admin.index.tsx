import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListOrders } from "@/integrations/mongodb/order.functions";
import { adminListProducts } from "@/integrations/mongodb/product.functions";
import { adminListUsers } from "@/integrations/mongodb/user.functions";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

// Dashboard derives its counts from the same admin list functions used by
// each dedicated screen, rather than a bespoke aggregation endpoint — the
// data volumes here (orders/products/customers for one store) don't warrant
// a separate optimized count query yet. Worth revisiting with a real
// aggregation pipeline if the catalog/order volume grows significantly.
function AdminDashboard() {
  const { data: orders } = useQuery({ queryKey: ["admin", "orders", "all"], queryFn: () => adminListOrders() });
  const { data: products } = useQuery({ queryKey: ["admin", "products", "all"], queryFn: () => adminListProducts() });
  const { data: customers } = useQuery({ queryKey: ["admin", "customers", "all"], queryFn: () => adminListUsers() });

  const totalRevenue = (orders ?? [])
    .filter((o) => ["paid", "fulfilled", "shipped", "delivered"].includes(o.status))
    .reduce((s, o) => s + o.total_cents, 0);
  const recent = (orders ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Revenue" value={formatMoney(totalRevenue, orders?.[0]?.currency)} />
        <Stat label="Orders" value={String(orders?.length ?? 0)} />
        <Stat label="Products" value={String(products?.length ?? 0)} />
        <Stat label="Customers" value={String(customers?.length ?? 0)} />
      </div>
      <div>
        <h2 className="font-semibold mb-2">Recent orders</h2>
        <div className="border rounded-lg divide-y">
          {recent.length ? recent.map((o) => (
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
