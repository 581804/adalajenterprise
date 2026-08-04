import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListOrders, adminUpdateOrder } from "@/integrations/mongodb/order.functions";
import { formatMoney } from "@/lib/format";
import { downloadInvoice } from "@/lib/invoice";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

const statuses = ["pending", "paid", "fulfilled", "shipped", "delivered", "cancelled", "refunded"];

function AdminOrders() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const { data: orders } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => adminListOrders(),
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => adminUpdateOrder({ data: { id, ...patch } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const changeStatus = (o: any, status: string) => {
    updateOrder.mutate({ id: o.id, patch: { status } });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="border rounded-lg divide-y">
        {orders?.map((o: any) => (
          <div key={o.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{o.order_number}</div>
              <div className="text-xs text-muted-foreground truncate">{o.email} · {new Date(o.created_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-medium">{formatMoney(o.total_cents, o.currency)}</div>
              <Select value={o.status} onValueChange={(status) => changeStatus(o, status)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Dialog open={selected?.id === o.id} onOpenChange={(v) => setSelected(v ? o : null)}>
                <DialogTrigger asChild><Button variant="outline" size="sm">View</Button></DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Order {o.order_number}</DialogTitle></DialogHeader>
                  <OrderDetail order={o} onSave={(patch) => updateOrder.mutate({ id: o.id, patch })} />
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

function OrderDetail({ order, onSave }: { order: any; onSave: (patch: any) => void }) {
  const { data: settings } = useSiteSettingsOptional();
  const handleDownloadInvoice = () => {
    try {
      downloadInvoice(order, { brand_name: settings?.brand_name, contact_email: settings?.contact_email, contact_phone: settings?.contact_phone });
    } catch (e: any) {
      toast.error("Couldn't generate invoice: " + (e?.message ?? "unknown error"));
    }
  };
  const [ship, setShip] = useState({
    carrier: order.carrier ?? "",
    tracking_number: order.tracking_number ?? "",
    tracking_url: order.tracking_url ?? "",
    admin_note: order.admin_note ?? "",
  });
  useEffect(() => {
    setShip({
      carrier: order.carrier ?? "",
      tracking_number: order.tracking_number ?? "",
      tracking_url: order.tracking_url ?? "",
      admin_note: order.admin_note ?? "",
    });
  }, [order.id]);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex justify-between items-center">
        <div><strong>Customer:</strong> {order.email}</div>
        <Button variant="outline" size="sm" onClick={handleDownloadInvoice}>
          <FileDown className="h-4 w-4 mr-1" /> Download invoice
        </Button>
      </div>
      <div>
        <strong>Shipping address:</strong>
        <pre className="mt-1 bg-muted p-2 rounded text-xs whitespace-pre-wrap">{JSON.stringify(order.shipping_address, null, 2)}</pre>
      </div>
      <div>
        <strong>Items:</strong>
        <ul className="mt-1 space-y-1">
          {order.order_items?.map((i: any) => (
            <li key={i.id}>{i.title}{i.variant_name ? ` (${i.variant_name})` : ""} × {i.quantity} — {formatMoney(i.unit_price_cents * i.quantity, order.currency)}</li>
          ))}
        </ul>
      </div>
      <div className="border-t pt-2">
        <div>Subtotal: {formatMoney(order.subtotal_cents, order.currency)}</div>
        <div>Shipping{order.shipping_method ? ` (${order.shipping_method})` : ""}: {formatMoney(order.shipping_cents, order.currency)}</div>
        {order.fee_cents > 0 ? <div>Fees: {formatMoney(order.fee_cents, order.currency)}</div> : null}
        <div>Tax: {formatMoney(order.tax_cents, order.currency)}</div>
        <div className="font-bold">Total: {formatMoney(order.total_cents, order.currency)}</div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">Shipping details (visible to customer)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Carrier</Label><Input value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} placeholder="e.g. Delhivery" /></div>
          <div><Label>Tracking #</Label><Input value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} /></div>
          <div className="col-span-2"><Label>Tracking URL</Label><Input value={ship.tracking_url} onChange={(e) => setShip({ ...ship, tracking_url: e.target.value })} placeholder="https://…" /></div>
          <div className="col-span-2"><Label>Note to customer</Label><Textarea value={ship.admin_note} onChange={(e) => setShip({ ...ship, admin_note: e.target.value })} rows={2} /></div>
        </div>
        <Button size="sm" onClick={() => onSave({
          carrier: ship.carrier || null,
          tracking_number: ship.tracking_number || null,
          tracking_url: ship.tracking_url || null,
          admin_note: ship.admin_note || null,
        })}>Save shipping info</Button>
      </div>
    </div>
  );
}
