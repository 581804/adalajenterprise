import { useSiteSettingsOptional } from "@/hooks/use-site-settings";

export function SiteFooter() {
  const { data: settings } = useSiteSettingsOptional();
  const year = new Date().getFullYear();
  const links = settings?.footer_nav?.length
    ? settings.footer_nav
    : [
        { label: "Privacy", url: "/pages/privacy" },
        { label: "Terms", url: "/pages/terms" },
        { label: "Contact", url: "/pages/contact" },
      ];
  const socials = Object.entries(settings?.social_links ?? {}).filter(([, v]) => v);
  return (
    <footer className="border-t bg-muted/30 mt-16">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="font-bold text-lg">{settings?.brand_name ?? "My Store"}</div>
          {settings?.tagline ? <p className="text-sm text-muted-foreground mt-1">{settings.tagline}</p> : null}
        </div>
        <div>
          <div className="font-semibold mb-2 text-sm">Links</div>
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.url}>
                <a href={l.url} className="text-sm text-muted-foreground hover:text-foreground">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2 text-sm">Contact</div>
          {settings?.contact_email ? (
            <p className="text-sm text-muted-foreground">{settings.contact_email}</p>
          ) : null}
          {settings?.contact_phone ? (
            <p className="text-sm text-muted-foreground">{settings.contact_phone}</p>
          ) : null}
          {socials.length ? (
            <div className="flex gap-3 mt-3">
              {socials.map(([name, url]) => (
                <a key={name} href={url} className="text-sm underline capitalize">
                  {name}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {year} {settings?.brand_name ?? "My Store"}. All rights reserved.
      </div>
    </footer>
  );
}
