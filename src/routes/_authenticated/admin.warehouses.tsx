import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminListWarehouses,
  adminCreateWarehouse,
  adminUpdateWarehouse,
  adminDeleteWarehouse,
  adminCheckGstReadiness,
} from "@/integrations/mongodb/warehouse.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Warehouse as WarehouseIcon, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/warehouses")({
  component: AdminWarehouses,
});

function AdminWarehouses() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ["admin", "warehouses"],
    queryFn: () => adminListWarehouses(),
  });

  const { data: readiness } = useQuery({
    queryKey: ["admin", "gst-readiness"],
    queryFn: () => adminCheckGstReadiness(),
  });

  const save = useMutation({
    mutationFn: async (w: any) => {
      const payload = {
        name: w.name,
        address_line1: w.address_line1,
        address_line2: w.address_line2 || null,
        city: w.city || null,
        pincode: w.pincode,
        gstin: w.gstin || null,
        is_active: w.is_active,
        priority: Number(w.priority) || 0,
      };
      if (w.id) await adminUpdateWarehouse({ data: { ...payload, id: w.id } });
      else await adminCreateWarehouse({ data: payload });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminDeleteWarehouse({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () =>
    setEditing({ name: "", address_line1: "", address_line2: "", city: "", pincode: "", gstin: "", is_active: true, priority: 0 });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Warehouses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each warehouse's state is looked up automatically from its pincode (via Admin → Pincodes data)
            — this is what determines CGST/SGST vs IGST on orders it fulfills, so it's never typed manually.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { openNew(); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />New warehouse
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} warehouse</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Ahmedabad Warehouse" /></div>
                <div><Label>Address line 1</Label><Input value={editing.address_line1} onChange={(e) => setEditing({ ...editing, address_line1: e.target.value })} /></div>
                <div><Label>Address line 2 (optional)</Label><Input value={editing.address_line2 ?? ""} onChange={(e) => setEditing({ ...editing, address_line2: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>City</Label><Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
                  <div>
                    <Label>Pincode</Label>
                    <Input value={editing.pincode} onChange={(e) => setEditing({ ...editing, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="6 digits" />
                  </div>
                </div>
                <div><Label>GSTIN (optional)</Label><Input value={editing.gstin ?? ""} onChange={(e) => setEditing({ ...editing, gstin: e.target.value.toUpperCase() })} placeholder="Leave blank to use the site-wide GSTIN" /></div>
                <div><Label>Priority (lower = preferred for fulfillment)</Label><Input type="number" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => save.mutate(editing)} disabled={save.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {readiness ? (
        <div className={`border rounded-lg p-4 space-y-2 ${readiness.has_active_warehouse && readiness.products_with_tax_rate > 0 ? "border-green-600/30 bg-green-50/50 dark:bg-green-950/20" : "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"}`}>
          <h2 className="font-semibold text-sm">GST setup checklist</h2>
          <p className="text-xs text-muted-foreground">
            No CGST/SGST/IGST shown on an order? Check each of these — all three are required for tax to calculate.
          </p>
          <div className="space-y-1.5 text-sm pt-1">
            <div className="flex items-center gap-2">
              {readiness.has_active_warehouse ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
              <span>
                {readiness.has_active_warehouse
                  ? `${readiness.active_warehouse_count} active warehouse${readiness.active_warehouse_count === 1 ? "" : "s"} configured`
                  : "No active warehouse — add one above, or GST never calculates and the old flat-tax behavior applies instead"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {readiness.products_with_tax_rate > 0 ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
              <span>
                {readiness.products_with_tax_rate > 0
                  ? `${readiness.products_with_tax_rate} of ${readiness.total_active_products} active products have a Tax rate assigned`
                  : `0 of ${readiness.total_active_products} active products have a Tax rate assigned — edit a product → Tax & fees → set a Tax rate, or no tax applies regardless of warehouses`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {readiness.has_any_stock_configured ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
              <span>
                {readiness.has_any_stock_configured
                  ? "Warehouse stock is configured for at least one product"
                  : "No warehouse stock configured for any product yet — set stock in the product editor's Warehouse stock section, or every order falls back to the old flat-tax behavior for insufficient stock"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      <div className="border rounded-lg divide-y">
        {warehouses?.map((w: any) => (
          <div key={w.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <WarehouseIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="font-medium">{w.name} {!w.is_active ? <span className="text-xs text-muted-foreground">(inactive)</span> : null}</div>
                <div className="text-xs text-muted-foreground">
                  {w.pincode} · {w.state} {w.gstin ? `· GSTIN ${w.gstin}` : ""} · priority {w.priority}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(w); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${w.name}"? Its stock records will also be removed.`)) del.mutate(w.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!warehouses?.length ? <p className="p-8 text-center text-muted-foreground">No warehouses yet. Add your first one above.</p> : null}
      </div>
    </div>
  );
}
