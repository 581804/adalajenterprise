import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminUpdateSiteSettings } from "@/integrations/mongodb/site-settings.functions";
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
    mutationFn: () => adminUpdateSiteSettings({ data: s }),
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
        <h2 className="font-semibold">SEO</h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Used as the default title/description/preview image for pages that don't set their own
          (product, category, and CMS pages override these automatically with their own content).
        </p>
        <div>
          <Label>Site title</Label>
          <Input value={s.seo?.title ?? ""} onChange={(e) => upd("seo", { ...(s.seo ?? {}), title: e.target.value })} placeholder={s.brand_name || "e.g. Adalaj Enterprise — Natural Camphor & More"} />
        </div>
        <div>
          <Label>Meta description</Label>
          <Textarea rows={2} maxLength={200} value={s.seo?.description ?? ""} onChange={(e) => upd("seo", { ...(s.seo ?? {}), description: e.target.value })} placeholder="Recommended: under 160 characters" />
          <p className="text-xs text-muted-foreground mt-1">{(s.seo?.description ?? "").length}/160</p>
        </div>
        <div>
          <Label>Social share image (OG image)</Label>
          <Input value={s.seo?.og_image ?? ""} onChange={(e) => upd("seo", { ...(s.seo ?? {}), og_image: e.target.value })} placeholder="https://…" />
          <p className="text-xs text-muted-foreground mt-1">Shown as the preview image when the site is shared on WhatsApp, Facebook, etc. Recommended: 1200×630px.</p>
          {s.seo?.og_image ? (
            <img src={s.seo.og_image} alt="OG preview" className="mt-2 max-w-xs rounded border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : null}
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

      <section className="space-y-4 border-t pt-6">
        <h2 className="font-semibold text-lg">Footer</h2>

        <div><Label>About text</Label><Textarea rows={3} value={s.footer?.about ?? ""} onChange={(e) => upd("footer", { ...(s.footer ?? {}), about: e.target.value })} /></div>
        <div><Label>Address</Label><Textarea rows={2} value={s.footer?.address ?? ""} onChange={(e) => upd("footer", { ...(s.footer ?? {}), address: e.target.value })} /></div>

        <div className="flex items-center gap-2">
          <Switch checked={s.footer?.show_social !== false} onCheckedChange={(v) => upd("footer", { ...(s.footer ?? {}), show_social: v })} />
          <Label>Show social links in footer</Label>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-sm">Social links (URL per network)</div>
          {(["facebook", "instagram", "twitter", "youtube", "linkedin", "whatsapp"] as const).map((k) => (
            <div key={k} className="flex gap-2 items-center">
              <Label className="w-28 capitalize">{k}</Label>
              <Input
                placeholder={`https://…`}
                value={s.social_links?.[k] ?? ""}
                onChange={(e) => upd("social_links", { ...(s.social_links ?? {}), [k]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-sm">Link columns</div>
          {(s.footer?.columns ?? []).map((col: any, ci: number) => (
            <div key={ci} className="border rounded p-3 space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Column title" value={col.title ?? ""} onChange={(e) => upd("footer", { ...s.footer, columns: s.footer.columns.map((c: any, i: number) => i === ci ? { ...c, title: e.target.value } : c) })} />
                <Button variant="ghost" size="icon" onClick={() => upd("footer", { ...s.footer, columns: s.footer.columns.filter((_: any, i: number) => i !== ci) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {(col.links ?? []).map((l: any, li: number) => (
                <div key={li} className="flex gap-2">
                  <Input placeholder="Label" value={l.label} onChange={(e) => upd("footer", { ...s.footer, columns: s.footer.columns.map((c: any, i: number) => i === ci ? { ...c, links: c.links.map((x: any, j: number) => j === li ? { ...x, label: e.target.value } : x) } : c) })} />
                  <Input placeholder="URL" value={l.url} onChange={(e) => upd("footer", { ...s.footer, columns: s.footer.columns.map((c: any, i: number) => i === ci ? { ...c, links: c.links.map((x: any, j: number) => j === li ? { ...x, url: e.target.value } : x) } : c) })} />
                  <Button variant="ghost" size="icon" onClick={() => upd("footer", { ...s.footer, columns: s.footer.columns.map((c: any, i: number) => i === ci ? { ...c, links: c.links.filter((_: any, j: number) => j !== li) } : c) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => upd("footer", { ...s.footer, columns: s.footer.columns.map((c: any, i: number) => i === ci ? { ...c, links: [...(c.links ?? []), { label: "", url: "" }] } : c) })}><Plus className="h-3 w-3 mr-1" />Add link</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => upd("footer", { ...(s.footer ?? {}), columns: [...(s.footer?.columns ?? []), { title: "", links: [] }] })}><Plus className="h-3 w-3 mr-1" />Add column</Button>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="font-semibold text-sm">Newsletter</div>
          <div className="flex items-center gap-2">
            <Switch checked={s.footer?.newsletter?.enabled ?? false} onCheckedChange={(v) => upd("footer", { ...(s.footer ?? {}), newsletter: { ...(s.footer?.newsletter ?? {}), enabled: v } })} />
            <Label>Show newsletter signup</Label>
          </div>
          <div><Label>Heading</Label><Input value={s.footer?.newsletter?.heading ?? ""} onChange={(e) => upd("footer", { ...s.footer, newsletter: { ...(s.footer?.newsletter ?? {}), heading: e.target.value } })} /></div>
          <div><Label>Subheading</Label><Input value={s.footer?.newsletter?.subheading ?? ""} onChange={(e) => upd("footer", { ...s.footer, newsletter: { ...(s.footer?.newsletter ?? {}), subheading: e.target.value } })} /></div>
          <div><Label>Input placeholder</Label><Input value={s.footer?.newsletter?.placeholder ?? ""} onChange={(e) => upd("footer", { ...s.footer, newsletter: { ...(s.footer?.newsletter ?? {}), placeholder: e.target.value } })} /></div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="font-semibold text-sm">Bottom bar links (Privacy, Terms, etc.)</div>
          {(s.footer?.bottom_links ?? []).map((l: any, i: number) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Label" value={l.label} onChange={(e) => upd("footer", { ...s.footer, bottom_links: s.footer.bottom_links.map((x: any, idx: number) => idx === i ? { ...x, label: e.target.value } : x) })} />
              <Input placeholder="URL" value={l.url} onChange={(e) => upd("footer", { ...s.footer, bottom_links: s.footer.bottom_links.map((x: any, idx: number) => idx === i ? { ...x, url: e.target.value } : x) })} />
              <Button variant="ghost" size="icon" onClick={() => upd("footer", { ...s.footer, bottom_links: s.footer.bottom_links.filter((_: any, idx: number) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => upd("footer", { ...(s.footer ?? {}), bottom_links: [...(s.footer?.bottom_links ?? []), { label: "", url: "" }] })}><Plus className="h-3 w-3 mr-1" />Add link</Button>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="font-semibold text-sm">Payment badge images (URLs)</div>
          {(s.footer?.payment_badges ?? []).map((url: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="https://…/visa.svg" value={url} onChange={(e) => upd("footer", { ...s.footer, payment_badges: s.footer.payment_badges.map((x: string, idx: number) => idx === i ? e.target.value : x) })} />
              <Button variant="ghost" size="icon" onClick={() => upd("footer", { ...s.footer, payment_badges: s.footer.payment_badges.filter((_: string, idx: number) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => upd("footer", { ...(s.footer ?? {}), payment_badges: [...(s.footer?.payment_badges ?? []), ""] })}><Plus className="h-3 w-3 mr-1" />Add badge</Button>
        </div>

        <div><Label>Copyright text</Label><Input placeholder="© {year} {brand}. All rights reserved." value={s.footer?.copyright ?? ""} onChange={(e) => upd("footer", { ...(s.footer ?? {}), copyright: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">Use <code>{"{year}"}</code> and <code>{"{brand}"}</code> as placeholders.</p>
      </section>


      <div className="sticky bottom-4">
        <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save all changes"}</Button>
      </div>
    </div>
  );
}
