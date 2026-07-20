import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

const statuses = ["pending", "paid", "fulfilled", "shipped", "delivered", "cancelled", "refunded"];

function AdminOrders() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const { data: orders } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => (await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false })).data ?? [],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, tracking_number }: any) => {
      const patch: any = { status };
      if (tracking_number !== undefined) patch.tracking_number = tracking_number;
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="border rounded-lg divide-y">
        {orders?.map((o: any) => (
          <div key={o.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{o.order_number}</div>
              <div className="text-xs text-muted-foreground">{o.email} · {new Date(o.created_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-medium">{formatMoney(o.total_cents, o.currency)}</div>
              <Select value={o.status} onValueChange={(status) => updateStatus.mutate({ id: o.id, status })}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Dialog>
                <DialogTrigger asChild><Button variant="outline" size="sm" onClick={() => setSelected(o)}>View</Button></DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Order {selected?.order_number}</DialogTitle></DialogHeader>
                  {selected ? (
                    <div className="space-y-3 text-sm">
                      <div><strong>Customer:</strong> {selected.email}</div>
                      <div><strong>Shipping:</strong> <pre className="mt-1 bg-muted p-2 rounded text-xs">{JSON.stringify(selected.shipping_address, null, 2)}</pre></div>
                      <div>
                        <strong>Items:</strong>
                        <ul className="mt-1 space-y-1">
                          {selected.order_items?.map((i: any) => (
                            <li key={i.id}>{i.title}{i.variant_name ? ` (${i.variant_name})` : ""} × {i.quantity} — {formatMoney(i.unit_price_cents * i.quantity, selected.currency)}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t pt-2">
                        <div>Subtotal: {formatMoney(selected.subtotal_cents, selected.currency)}</div>
                        <div>Shipping: {formatMoney(selected.shipping_cents, selected.currency)}</div>
                        <div>Tax: {formatMoney(selected.tax_cents, selected.currency)}</div>
                        <div className="font-bold">Total: {formatMoney(selected.total_cents, selected.currency)}</div>
                      </div>
                    </div>
                  ) : null}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ))}
        {!orders?.length ? <p className="p-8 text-center text-muted-foreground">No orders yet.</p> : null}
      </div>
    </div>
  );
}
