import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  component: AdminProducts,
});

function AdminProducts() {
  const qc = useQueryClient();
  const { data: products } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button asChild><Link to="/admin/products/new"><Plus className="h-4 w-4 mr-2" />New product</Link></Button>
      </div>
      <div className="border rounded-lg divide-y">
        {products && products.length ? products.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-muted overflow-hidden">
                {Array.isArray(p.images) && p.images[0] ? (
                  <img src={typeof p.images[0] === "string" ? p.images[0] : p.images[0].url} className="w-full h-full object-cover" alt="" />
                ) : null}
              </div>
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">
                  {p.categories?.name ?? "Uncategorized"} · {p.status} · Stock: {p.stock}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>{formatMoney(p.price_cents, p.currency)}</div>
              <Button asChild variant="ghost" size="icon"><Link to="/admin/products/$id" params={{ id: p.id }}><Pencil className="h-4 w-4" /></Link></Button>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this product?")) del.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        )) : <div className="p-8 text-center text-muted-foreground">No products yet. <Link to="/admin/products/new" className="underline">Add your first</Link>.</div>}
      </div>
    </div>
  );
}
