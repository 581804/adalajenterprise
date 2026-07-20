import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/taxes")({
  component: AdminTaxes,
});

function AdminTaxes() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin", "taxes"],
    queryFn: async () => (await supabase.from("tax_rates").select("*").order("country")).data ?? [],
  });
  const save = useMutation({
    mutationFn: async (t: any) => {
      const payload = { ...t, rate_percent: Number(t.rate_percent) || 0 };
      if (t.id) { const { error } = await supabase.from("tax_rates").update(payload).eq("id", t.id); if (error) throw error; }
      else { const { error } = await supabase.from("tax_rates").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "taxes"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tax_rates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "taxes"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tax rates</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setEditing({ name: "", country: "", region: "", rate_percent: 0, is_active: true })}><Plus className="h-4 w-4 mr-2" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tax rate</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Country (ISO code)</Label><Input value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} /></div>
                <div><Label>Region (optional)</Label><Input value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} /></div>
                <div><Label>Rate %</Label><Input type="number" step="0.01" value={editing.rate_percent} onChange={(e) => setEditing({ ...editing, rate_percent: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => save.mutate(editing)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg divide-y">
        {data?.map((t) => (
          <div key={t.id} className="flex justify-between items-center p-3">
            <div><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.country}{t.region ? ` / ${t.region}` : ""} · {String(t.rate_percent)}%</div></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!data?.length ? <p className="p-8 text-center text-muted-foreground">No tax rates yet.</p> : null}
      </div>
    </div>
  );
}
