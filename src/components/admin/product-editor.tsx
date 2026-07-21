import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slugify } from "@/lib/format";
import { Trash2, Upload, Plus } from "lucide-react";

type Product = any;

// Only columns that exist on `products` — never send joined relations back on update.
const PRODUCT_COLUMNS = [
  "slug", "title", "description", "short_description",
  "price_cents", "compare_at_cents", "currency", "category_id",
  "status", "images", "tags", "stock", "sku", "weight_grams",
  "seo", "is_featured",
  "tax_rate_id", "price_includes_tax", "fee_category_id",
];

// UI works in rupees (float). DB stores paise (integer).
const toMinor = (rupees: any): number => {
  if (rupees === "" || rupees === null || rupees === undefined) return 0;
  const n = Number(rupees);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
};
const toMajor = (minor: any): string => {
  if (minor === null || minor === undefined || minor === "") return "";
  return (Number(minor) / 100).toString();
};

export function ProductEditor({ initial, onSaved }: { initial: Product | null; onSaved?: (id: string) => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState<any>(() => {
    const base = initial ?? {
      slug: "", title: "", description: "", short_description: "",
      price_cents: 0, compare_at_cents: null, currency: "INR",
      category_id: null, status: "draft", images: [], stock: 0,
      sku: "", is_featured: false, tags: [], seo: {},
      tax_rate_id: null, price_includes_tax: false, fee_category_id: null,
    };
    return {
      ...base,
      _price: toMajor(base.price_cents),
      _compare: toMajor(base.compare_at_cents),
      _tags: (base.tags ?? []).join(", "),
      seo: base.seo ?? {},
    };
  });
  const [variants, setVariants] = useState<any[]>(
    (initial?.product_variants ?? []).map((v: any) => ({
      ...v,
      _price: toMajor(v.price_cents),
    })),
  );
  const [uploading, setUploading] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories", "admin"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });
  const { data: taxRates } = useQuery({
    queryKey: ["tax-rates", "admin"],
    queryFn: async () => (await supabase.from("tax_rates").select("id, name, rate_percent").order("name")).data ?? [],
  });
  const { data: feeCategories } = useQuery({
    queryKey: ["fee-categories", "admin"],
    queryFn: async () => (await supabase.from("fee_categories").select("id, name").order("name")).data ?? [],
  });

  const upd = (k: string) => (e: any) => setP((prev: any) => ({ ...prev, [k]: e.target?.value ?? e }));
  const updSeo = (k: string) => (e: any) =>
    setP((prev: any) => ({ ...prev, seo: { ...(prev.seo ?? {}), [k]: e.target?.value ?? e } }));

  const save = useMutation({
    mutationFn: async () => {
      // Build payload from allowed columns only.
      const raw: any = {
        ...p,
        price_cents: toMinor(p._price),
        compare_at_cents: p._compare === "" || p._compare == null ? null : toMinor(p._compare),
        stock: Number(p.stock) || 0,
        tags: (p._tags ?? "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean),
        slug: p.slug || slugify(p.title),
        currency: p.currency || "INR",
      };
      const payload: any = {};
      for (const k of PRODUCT_COLUMNS) if (k in raw) payload[k] = raw[k];

      let productId = initial?.id;
      if (initial) {
        const { error } = await supabase.from("products").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
      }
      // sync variants
      const existingIds = initial?.product_variants?.map((v: any) => v.id) ?? [];
      const keptIds = variants.filter((v) => v.id).map((v) => v.id);
      const toDelete = existingIds.filter((id: string) => !keptIds.includes(id));
      if (toDelete.length) await supabase.from("product_variants").delete().in("id", toDelete);
      for (const v of variants) {
        const price = v._price === "" || v._price == null ? null : toMinor(v._price);
        const vp: any = {
          product_id: productId,
          name: v.name,
          sku: v.sku ?? null,
          price_cents: price,
          stock: Number(v.stock) || 0,
          option_values: v.option_values ?? {},
        };
        if (v.id) await supabase.from("product_variants").update(vp).eq("id", v.id);
        else await supabase.from("product_variants").insert(vp);
      }
      return productId!;
    },
    onSuccess: (id) => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "product", id] });
      onSaved?.(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const path = `products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("store-media").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("store-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const url = signed?.signedUrl;
      if (!url) throw new Error("Could not get URL");
      setP((prev: any) => ({ ...prev, images: [...(prev.images ?? []), url] }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Title</Label><Input value={p.title} onChange={upd("title")} /></div>
        <div><Label>Slug</Label><Input value={p.slug} onChange={upd("slug")} placeholder="auto from title" /></div>
        <div className="md:col-span-2"><Label>Short description</Label><Input value={p.short_description ?? ""} onChange={upd("short_description")} /></div>
        <div className="md:col-span-2"><Label>Description</Label><Textarea rows={6} value={p.description ?? ""} onChange={upd("description")} /></div>
        <div>
          <Label>Price (₹)</Label>
          <Input type="number" step="0.01" min="0" value={p._price}
            onChange={(e) => setP((prev: any) => ({ ...prev, _price: e.target.value }))} />
        </div>
        <div>
          <Label>Compare-at price (₹)</Label>
          <Input type="number" step="0.01" min="0" value={p._compare}
            onChange={(e) => setP((prev: any) => ({ ...prev, _compare: e.target.value }))} />
        </div>
        <div><Label>Currency</Label><Input value={p.currency} onChange={upd("currency")} /></div>
        <div><Label>SKU</Label><Input value={p.sku ?? ""} onChange={upd("sku")} /></div>
        <div><Label>Stock</Label><Input type="number" value={p.stock} onChange={upd("stock")} /></div>
        <div>
          <Label>Category</Label>
          <Select value={p.category_id ?? "none"} onValueChange={(v) => setP((prev: any) => ({ ...prev, category_id: v === "none" ? null : v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={p.status} onValueChange={(v) => setP((prev: any) => ({ ...prev, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={p.is_featured} onCheckedChange={(v) => setP((prev: any) => ({ ...prev, is_featured: v }))} />
          <Label>Featured on homepage</Label>
        </div>
      </div>

      <div className="border-t pt-6 space-y-3">
        <h3 className="font-semibold">Tax & fees</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Tax rate</Label>
            <Select value={p.tax_rate_id ?? "none"} onValueChange={(v) => setP((prev: any) => ({ ...prev, tax_rate_id: v === "none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="No tax" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No tax</SelectItem>
                {taxRates?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate_percent}%)</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Leave as "No tax" to hide the tax line at checkout.</p>
          </div>
          <div>
            <Label>Fee category</Label>
            <Select value={p.fee_category_id ?? "none"} onValueChange={(v) => setP((prev: any) => ({ ...prev, fee_category_id: v === "none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="No fee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No fee</SelectItem>
                {feeCategories?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Manage in Admin → Fees.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!p.price_includes_tax} onCheckedChange={(v) => setP((prev: any) => ({ ...prev, price_includes_tax: v }))} />
          <Label>Price includes tax (inclusive)</Label>
        </div>
      </div>


      <div>
        <Label>Images</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {(p.images ?? []).map((img: any, i: number) => (
            <div key={i} className="relative aspect-square rounded border overflow-hidden">
              <img src={typeof img === "string" ? img : img.url} className="w-full h-full object-cover" alt="" />
              <button
                onClick={() => setP((prev: any) => ({ ...prev, images: prev.images.filter((_: any, idx: number) => idx !== i) }))}
                className="absolute top-1 right-1 bg-black/60 text-white rounded p-1"
              ><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <label className="aspect-square rounded border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>
        </div>
        {uploading ? <p className="text-xs text-muted-foreground mt-1">Uploading…</p> : null}
      </div>

      <div className="space-y-3 border-t pt-6">
        <h3 className="font-semibold">SEO</h3>
        <div>
          <Label>SEO Meta Title</Label>
          <Input value={p.seo?.title ?? ""} onChange={updSeo("title")} placeholder="Recommended: under 60 characters" maxLength={70} />
          <p className="text-xs text-muted-foreground mt-1">{(p.seo?.title ?? "").length}/60</p>
        </div>
        <div>
          <Label>SEO Meta Description</Label>
          <Textarea rows={3} value={p.seo?.description ?? ""} onChange={updSeo("description")} placeholder="Recommended: under 160 characters" maxLength={200} />
          <p className="text-xs text-muted-foreground mt-1">{(p.seo?.description ?? "").length}/160</p>
        </div>
        <div>
          <Label>Product Tags</Label>
          <Input value={p._tags} onChange={(e) => setP((prev: any) => ({ ...prev, _tags: e.target.value }))} placeholder="Comma-separated, e.g. natural, ayurvedic, camphor" />
          <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Variants (optional)</Label>
          <Button variant="outline" size="sm" onClick={() => setVariants((v) => [...v, { name: "", stock: 0, _price: "" }])}>
            <Plus className="h-3 w-3 mr-1" />Add variant
          </Button>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-4" placeholder="Name (e.g. Small / Red)" value={v.name} onChange={(e) => setVariants((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
              <Input className="col-span-2" placeholder="SKU" value={v.sku ?? ""} onChange={(e) => setVariants((prev) => prev.map((x, idx) => idx === i ? { ...x, sku: e.target.value } : x))} />
              <Input className="col-span-3" type="number" step="0.01" placeholder="Price override (₹)" value={v._price ?? ""} onChange={(e) => setVariants((prev) => prev.map((x, idx) => idx === i ? { ...x, _price: e.target.value } : x))} />
              <Input className="col-span-2" type="number" placeholder="Stock" value={v.stock ?? 0} onChange={(e) => setVariants((prev) => prev.map((x, idx) => idx === i ? { ...x, stock: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save product"}</Button>
    </div>
  );
}
