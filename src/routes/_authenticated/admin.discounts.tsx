import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/discounts")({
  component: AdminDiscounts,
});

function AdminDiscounts() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin", "discounts"],
    queryFn: async () => (await supabase.from("discounts").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const save = useMutation({
    mutationFn: async (d: any) => {
      const payload = {
        code: d.code.toUpperCase().trim(),
        description: d.description ?? null,
        type: d.type,
        value: Number(d.value) || 0,
        min_subtotal_cents: Number(d.min_subtotal_cents) || 0,
        usage_limit: d.unlimited ? null : (d.usage_limit ? Number(d.usage_limit) : null),
        starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
        ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
        is_active: !!d.is_active,
      };
      if (d.id) { const { error } = await supabase.from("discounts").update(payload).eq("id", d.id); if (error) throw error; }
      else { const { error } = await supabase.from("discounts").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "discounts"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("discounts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "discounts"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Discounts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setEditing({ code: "", description: "", type: "percent", value: 10, is_active: true })}><Plus className="h-4 w-4 mr-2" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} discount</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Code</Label><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div><Label>Type</Label>
                  <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent off</SelectItem>
                      <SelectItem value="fixed">Fixed amount (cents)</SelectItem>
                      <SelectItem value="free_shipping">Free shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} /></div>
                <div><Label>Min subtotal (cents)</Label><Input type="number" value={editing.min_subtotal_cents ?? 0} onChange={(e) => setEditing({ ...editing, min_subtotal_cents: e.target.value })} /></div>
                <div><Label>Usage limit</Label><Input type="number" value={editing.usage_limit ?? ""} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => save.mutate(editing)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg divide-y">
        {data?.map((d) => (
          <div key={d.id} className="flex justify-between items-center p-3">
            <div>
              <div className="font-medium">{d.code}</div>
              <div className="text-xs text-muted-foreground">{d.type} · {String(d.value)} · used {d.used_count}{d.usage_limit ? `/${d.usage_limit}` : ""} · {d.is_active ? "active" : "off"}</div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!data?.length ? <p className="p-8 text-center text-muted-foreground">No discounts yet.</p> : null}
      </div>
    </div>
  );
}
