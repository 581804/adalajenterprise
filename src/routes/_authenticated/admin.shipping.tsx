import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  component: AdminShipping,
});

function AdminShipping() {
  const qc = useQueryClient();
  const { data: zones } = useQuery({
    queryKey: ["admin", "zones"],
    queryFn: async () => (await supabase.from("shipping_zones").select("*, shipping_rates(*)").order("name")).data ?? [],
  });

  const addZone = async () => {
    const name = prompt("Zone name (e.g. United States)");
    if (!name) return;
    const countries = (prompt("Countries (comma-separated ISO codes, e.g. US,CA)") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("shipping_zones").insert({ name, countries });
    if (error) toast.error(error.message); else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["admin", "zones"] }); }
  };
  const delZone = async (id: string) => { if (!confirm("Delete zone?")) return; await supabase.from("shipping_zones").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["admin", "zones"] }); };
  const addRate = async (zone_id: string) => {
    const name = prompt("Rate name (e.g. Standard)"); if (!name) return;
    const price = Number(prompt("Price in cents") ?? "0");
    const { error } = await supabase.from("shipping_rates").insert({ zone_id, name, price_cents: price });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["admin", "zones"] });
  };
  const delRate = async (id: string) => { await supabase.from("shipping_rates").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["admin", "zones"] }); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Shipping</h1>
        <Button onClick={addZone}><Plus className="h-4 w-4 mr-2" />New zone</Button>
      </div>
      <div className="space-y-4">
        {zones?.map((z: any) => (
          <div key={z.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div><div className="font-medium">{z.name}</div><div className="text-xs text-muted-foreground">Countries: {z.countries.join(", ") || "—"}</div></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => addRate(z.id)}>Add rate</Button>
                <Button variant="ghost" size="icon" onClick={() => delZone(z.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="pl-4 space-y-1">
              {z.shipping_rates?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.name} — ${(r.price_cents / 100).toFixed(2)} {r.free_over_cents ? `(free over $${(r.free_over_cents / 100).toFixed(2)})` : ""}</span>
                  <Button variant="ghost" size="icon" onClick={() => delRate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              {!z.shipping_rates?.length ? <p className="text-xs text-muted-foreground">No rates yet.</p> : null}
            </div>
          </div>
        ))}
        {!zones?.length ? <p className="p-8 text-center text-muted-foreground">No zones yet.</p> : null}
      </div>
    </div>
  );
}
