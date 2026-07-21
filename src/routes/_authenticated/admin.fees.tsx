import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/fees")({
  component: AdminFees,
});

type Fee = {
  id?: string;
  name: string;
  description?: string | null;
  _amount: string;
  percent: string | number;
  scope: "per_unit" | "per_order";
  taxable: boolean;
  tax_rate_id: string | null;
  is_active: boolean;
};

function AdminFees() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Fee | null>(null);
  const [open, setOpen] = useState(false);

  const { data: fees } = useQuery({
    queryKey: ["admin", "fees"],
    queryFn: async () => (await supabase.from("fee_categories").select("*").order("name")).data ?? [],
  });
  const { data: taxes } = useQuery({
    queryKey: ["admin", "taxes-for-fees"],
    queryFn: async () => (await supabase.from("tax_rates").select("id, name").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (f: Fee) => {
      const payload = {
        name: f.name,
        description: f.description ?? null,
        amount_cents: Math.round((Number(f._amount) || 0) * 100),
        percent: Number(f.percent) || 0,
        scope: f.scope,
        taxable: f.taxable,
        tax_rate_id: f.tax_rate_id,
        is_active: f.is_active,
      };
      if (f.id) {
        const { error } = await supabase.from("fee_categories").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "fees"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fee_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "fees"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () =>
    setEditing({
      name: "",
      description: "",
      _amount: "0",
      percent: 0,
      scope: "per_unit",
      taxable: false,
      tax_rate_id: null,
      is_active: true,
    });

  const openEdit = (row: any) =>
    setEditing({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      _amount: ((row.amount_cents ?? 0) / 100).toString(),
      percent: row.percent ?? 0,
      scope: row.scope ?? "per_unit",
      taxable: !!row.taxable,
      tax_rate_id: row.tax_rate_id ?? null,
      is_active: !!row.is_active,
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Fees</h1>
          <p className="text-sm text-muted-foreground">
            Create fee categories (handling, packaging, service, etc.) and assign one to each product.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { openNew(); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />New fee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Fee category</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Handling, Packaging" /></div>
                <div><Label>Description (optional)</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input type="number" step="0.01" min="0" value={editing._amount}
                      onChange={(e) => setEditing({ ...editing, _amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Percent (%)</Label>
                    <Input type="number" step="0.01" min="0" value={editing.percent}
                      onChange={(e) => setEditing({ ...editing, percent: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">Fee = flat amount + (percent × product price). Leave either at 0.</p>
                <div>
                  <Label>Scope</Label>
                  <Select value={editing.scope} onValueChange={(v: any) => setEditing({ ...editing, scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_unit">Per unit (charged for every quantity)</SelectItem>
                      <SelectItem value="per_order">Per order (charged once)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.taxable} onCheckedChange={(v) => setEditing({ ...editing, taxable: v })} />
                  <Label>Fee is taxable</Label>
                </div>
                {editing.taxable ? (
                  <div>
                    <Label>Tax rate for this fee</Label>
                    <Select value={editing.tax_rate_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, tax_rate_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use product's tax rate</SelectItem>
                        {taxes?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Active</Label>
                </div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => editing && save.mutate(editing)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg divide-y">
        {fees?.map((f: any) => (
          <div key={f.id} className="flex justify-between items-center p-3">
            <div>
              <div className="font-medium">
                {f.name} {!f.is_active ? <span className="text-xs text-muted-foreground">(inactive)</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                ₹{((f.amount_cents ?? 0) / 100).toFixed(2)}
                {Number(f.percent) ? ` + ${f.percent}%` : ""} · {f.scope === "per_unit" ? "per unit" : "per order"}
                {f.taxable ? " · taxable" : ""}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { openEdit(f); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => confirm("Delete this fee?") && del.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!fees?.length ? <p className="p-8 text-center text-muted-foreground">No fee categories yet.</p> : null}
      </div>
    </div>
  );
}
