import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminListShippingZones,
  adminCreateShippingZone,
  adminUpdateShippingZone,
  adminDeleteShippingZone,
} from "@/integrations/mongodb/shipping-zone.functions";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  component: AdminShipping,
});

function AdminShipping() {
  const qc = useQueryClient();
  const { data: zones } = useQuery({
    queryKey: ["admin", "zones"],
    queryFn: () => adminListShippingZones(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "zones"] });

  const addZone = async () => {
    const name = prompt("Zone name (e.g. United States)");
    if (!name) return;
    const countries = (prompt("Countries (comma-separated ISO codes, e.g. US,CA)") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await adminCreateShippingZone({ data: { name, countries } });
      toast.success("Added");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const delZone = async (id: string) => {
    if (!confirm("Delete zone?")) return;
    await adminDeleteShippingZone({ data: { id } });
    invalidate();
  };
  const addRate = async (zone: any) => {
    const name = prompt("Rate name (e.g. Standard)");
    if (!name) return;
    const price = Number(prompt("Price in cents") ?? "0");
    try {
      await adminUpdateShippingZone({
        data: { id: zone.id, name: zone.name, countries: zone.countries, is_active: zone.is_active, rates: [...zone.shipping_rates, { name, price_cents: price }] },
      });
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const delRate = async (zone: any, rateId: string) => {
    await adminUpdateShippingZone({
      data: { id: zone.id, name: zone.name, countries: zone.countries, is_active: zone.is_active, rates: zone.shipping_rates.filter((r: any) => r.id !== rateId) },
    });
    invalidate();
  };

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
                <Button variant="outline" size="sm" onClick={() => addRate(z)}>Add rate</Button>
                <Button variant="ghost" size="icon" onClick={() => delZone(z.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="pl-4 space-y-1">
              {z.shipping_rates?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.name} — ${(r.price_cents / 100).toFixed(2)} {r.free_over_cents ? `(free over $${(r.free_over_cents / 100).toFixed(2)})` : ""}</span>
                  <Button variant="ghost" size="icon" onClick={() => delRate(z, r.id)}><Trash2 className="h-3 w-3" /></Button>
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
