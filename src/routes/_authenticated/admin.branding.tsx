import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  component: AdminBranding,
});

function AdminBranding() {
  const { data: initial } = useSiteSettingsOptional();
  const qc = useQueryClient();
  const [s, setS] = useState<any>(null);

  useEffect(() => { if (initial && !s) setS(initial); }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_settings").update(s).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["site_settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!s) return <p>Loading…</p>;

  const upd = (k: string, v: any) => setS({ ...s, [k]: v });

  const editList = (key: "header_nav" | "footer_nav") => (
    <div className="space-y-2">
      {(s[key] ?? []).map((it: any, i: number) => (
        <div key={i} className="flex gap-2">
          <Input placeholder="Label" value={it.label} onChange={(e) => upd(key, s[key].map((x: any, idx: number) => idx === i ? { ...x, label: e.target.value } : x))} />
          <Input placeholder="URL" value={it.url} onChange={(e) => upd(key, s[key].map((x: any, idx: number) => idx === i ? { ...x, url: e.target.value } : x))} />
          <Button variant="ghost" size="icon" onClick={() => upd(key, s[key].filter((_: any, idx: number) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => upd(key, [...(s[key] ?? []), { label: "", url: "" }])}><Plus className="h-3 w-3 mr-1" />Add link</Button>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Branding & site settings</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">Brand</h2>
        <div><Label>Brand name</Label><Input value={s.brand_name ?? ""} onChange={(e) => upd("brand_name", e.target.value)} /></div>
        <div><Label>Tagline</Label><Input value={s.tagline ?? ""} onChange={(e) => upd("tagline", e.target.value)} /></div>
        <div><Label>Logo URL</Label><Input value={s.logo_url ?? ""} onChange={(e) => upd("logo_url", e.target.value)} /></div>
        <div><Label>Favicon URL</Label><Input value={s.favicon_url ?? ""} onChange={(e) => upd("favicon_url", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Primary color</Label><Input value={s.primary_color ?? ""} onChange={(e) => upd("primary_color", e.target.value)} /></div>
          <div><Label>Accent color</Label><Input value={s.accent_color ?? ""} onChange={(e) => upd("accent_color", e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Currency</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Currency code</Label><Input value={s.currency ?? ""} onChange={(e) => upd("currency", e.target.value)} /></div>
          <div><Label>Symbol</Label><Input value={s.currency_symbol ?? ""} onChange={(e) => upd("currency_symbol", e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Contact</h2>
        <div><Label>Email</Label><Input value={s.contact_email ?? ""} onChange={(e) => upd("contact_email", e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={s.contact_phone ?? ""} onChange={(e) => upd("contact_phone", e.target.value)} /></div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Header navigation</h2>
        {editList("header_nav")}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Footer navigation</h2>
        {editList("footer_nav")}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Announcement bar</h2>
        <div className="flex items-center gap-2"><Switch checked={s.announcement?.enabled ?? false} onCheckedChange={(v) => upd("announcement", { ...(s.announcement ?? {}), enabled: v })} /><Label>Enabled</Label></div>
        <div><Label>Text</Label><Input value={s.announcement?.text ?? ""} onChange={(e) => upd("announcement", { ...(s.announcement ?? {}), text: e.target.value })} /></div>
        <div><Label>Link</Label><Input value={s.announcement?.link ?? ""} onChange={(e) => upd("announcement", { ...(s.announcement ?? {}), link: e.target.value })} /></div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Homepage banners</h2>
        {(s.banners ?? []).map((b: any, i: number) => (
          <div key={i} className="border rounded p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Headline" value={b.headline ?? ""} onChange={(e) => upd("banners", s.banners.map((x: any, idx: number) => idx === i ? { ...x, headline: e.target.value } : x))} />
              <Input placeholder="Subhead" value={b.subhead ?? ""} onChange={(e) => upd("banners", s.banners.map((x: any, idx: number) => idx === i ? { ...x, subhead: e.target.value } : x))} />
              <Input placeholder="Image URL" value={b.image ?? ""} onChange={(e) => upd("banners", s.banners.map((x: any, idx: number) => idx === i ? { ...x, image: e.target.value } : x))} />
              <Input placeholder="CTA label" value={b.cta_label ?? ""} onChange={(e) => upd("banners", s.banners.map((x: any, idx: number) => idx === i ? { ...x, cta_label: e.target.value } : x))} />
              <Input placeholder="CTA URL" value={b.cta_url ?? ""} onChange={(e) => upd("banners", s.banners.map((x: any, idx: number) => idx === i ? { ...x, cta_url: e.target.value } : x))} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => upd("banners", s.banners.filter((_: any, idx: number) => idx !== i))}><Trash2 className="h-3 w-3 mr-1" />Remove</Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => upd("banners", [...(s.banners ?? []), {}])}><Plus className="h-3 w-3 mr-1" />Add banner</Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">SEO defaults</h2>
        <div><Label>Title</Label><Input value={s.seo?.title ?? ""} onChange={(e) => upd("seo", { ...(s.seo ?? {}), title: e.target.value })} /></div>
        <div><Label>Description</Label><Textarea value={s.seo?.description ?? ""} onChange={(e) => upd("seo", { ...(s.seo ?? {}), description: e.target.value })} /></div>
        <div><Label>OG image URL</Label><Input value={s.seo?.og_image ?? ""} onChange={(e) => upd("seo", { ...(s.seo ?? {}), og_image: e.target.value })} /></div>
      </section>

      <div className="sticky bottom-4">
        <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save all changes"}</Button>
      </div>
    </div>
  );
}
