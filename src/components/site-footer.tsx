import { useState } from "react";
import { toast } from "sonner";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin } from "lucide-react";

export function SiteFooter() {
  const { data: settings } = useSiteSettingsOptional();
  const year = new Date().getFullYear();
  const footer = settings?.footer;
  const brand = settings?.brand_name ?? "My Store";

  const legacyLinks = settings?.footer_nav ?? [];
  const columns =
    footer?.columns && footer.columns.length > 0
      ? footer.columns
      : legacyLinks.length > 0
        ? [{ title: "Links", links: legacyLinks }]
        : [];

  const socials = footer?.show_social !== false
    ? Object.entries(settings?.social_links ?? {}).filter(([, v]) => v)
    : [];

  const [email, setEmail] = useState("");
  const submitNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success("Thanks for subscribing!");
    setEmail("");
  };

  return (
    <footer className="border-t bg-muted/30 mt-16">
      <div className="container mx-auto px-4 py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={brand} className="h-10 w-10 object-contain" />
            ) : null}
            <div className="font-bold text-lg">{brand}</div>
          </div>
          {footer?.about ? (
            <p className="text-sm text-muted-foreground">{footer.about}</p>
          ) : settings?.tagline ? (
            <p className="text-sm text-muted-foreground">{settings.tagline}</p>
          ) : null}
          {footer?.address ? (
            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="whitespace-pre-line">{footer.address}</span>
            </p>
          ) : null}
          {settings?.contact_email ? (
            <a href={`mailto:${settings.contact_email}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> {settings.contact_email}
            </a>
          ) : null}
          {settings?.contact_phone ? (
            <a href={`tel:${settings.contact_phone}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4" /> {settings.contact_phone}
            </a>
          ) : null}
          {socials.length ? (
            <div className="flex gap-3 pt-1">
              {socials.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer" className="text-sm underline capitalize text-muted-foreground hover:text-foreground">
                  {name}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {columns.map((col, i) => (
          <div key={i}>
            <div className="font-semibold mb-3 text-sm">{col.title}</div>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.url + l.label}>
                  <a href={l.url} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {footer?.newsletter?.enabled ? (
          <div>
            <div className="font-semibold mb-2 text-sm">{footer.newsletter.heading || "Newsletter"}</div>
            {footer.newsletter.subheading ? (
              <p className="text-sm text-muted-foreground mb-3">{footer.newsletter.subheading}</p>
            ) : null}
            <form onSubmit={submitNewsletter} className="flex gap-2">
              <Input
                type="email"
                required
                placeholder={footer.newsletter.placeholder || "you@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="sm">Join</Button>
            </form>
          </div>
        ) : null}
      </div>

      {footer?.payment_badges && footer.payment_badges.length > 0 ? (
        <div className="container mx-auto px-4 pb-4 flex flex-wrap items-center gap-3 justify-center md:justify-end">
          {footer.payment_badges.map((src, i) => (
            <img key={i} src={src} alt="Payment method" className="h-6 object-contain opacity-80" />
          ))}
        </div>
      ) : null}

      <div className="border-t">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            {footer?.copyright?.trim()
              ? footer.copyright.replace("{year}", String(year)).replace("{brand}", brand)
              : `© ${year} ${brand}. All rights reserved.`}
          </div>
          {footer?.bottom_links && footer.bottom_links.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {footer.bottom_links.map((l) => (
                <a key={l.url + l.label} href={l.url} className="hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
