import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth-middleware";

// Matches the `SiteSettings` type in src/hooks/use-site-settings.ts exactly,
// field for field, since that hook's consumers expect this precise shape.
function serializeSettings(s: any) {
  return {
    id: 1,
    brand_name: s.brandName,
    tagline: s.tagline ?? null,
    logo_url: s.logoUrl ?? null,
    favicon_url: s.faviconUrl ?? null,
    currency: s.currency,
    currency_symbol: s.currencySymbol,
    primary_color: s.primaryColor,
    accent_color: s.accentColor,
    contact_email: s.contactEmail ?? null,
    contact_phone: s.contactPhone ?? null,
    social_links: s.socialLinks ?? {},
    header_nav: s.headerNav ?? [],
    footer_nav: s.footerNav ?? [],
    banners: s.banners ?? [],
    announcement: s.announcement ?? { enabled: false, text: "", link: "" },
    seo: s.seo ?? { title: s.brandName, description: "", og_image: "" },
    footer: s.footer ?? {},
  };
}

/** Public: the site-wide settings singleton, read by nearly every page. */
export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { connectMongo } = await import("./client.server");
  const { getOrCreateSiteSettings } = await import("./models/site-settings.server");
  await connectMongo();
  const settings = await getOrCreateSiteSettings();
  return serializeSettings(settings);
});

const settingsInput = z.object({
  brand_name: z.string().optional(),
  tagline: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  favicon_url: z.string().optional().nullable(),
  currency: z.string().optional(),
  currency_symbol: z.string().optional(),
  primary_color: z.string().optional(),
  accent_color: z.string().optional(),
  contact_email: z.string().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  social_links: z.record(z.string()).optional(),
  header_nav: z.array(z.unknown()).optional(),
  footer_nav: z.array(z.unknown()).optional(),
  banners: z.array(z.unknown()).optional(),
  announcement: z.object({ enabled: z.boolean(), text: z.string(), link: z.string().optional() }).optional(),
  seo: z.record(z.unknown()).optional(),
  footer: z.record(z.unknown()).optional(),
});

export const adminUpdateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(settingsInput)
  .handler(async ({ data }) => {
    const { connectMongo } = await import("./client.server");
    const { SiteSettings, SITE_SETTINGS_ID, getOrCreateSiteSettings } = await import("./models/site-settings.server");
    await connectMongo();
    await getOrCreateSiteSettings(); // ensure the singleton exists before patching it

    const patch: Record<string, unknown> = {};
    if (data.brand_name !== undefined) patch.brandName = data.brand_name;
    if (data.tagline !== undefined) patch.tagline = data.tagline;
    if (data.logo_url !== undefined) patch.logoUrl = data.logo_url;
    if (data.favicon_url !== undefined) patch.faviconUrl = data.favicon_url;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.currency_symbol !== undefined) patch.currencySymbol = data.currency_symbol;
    if (data.primary_color !== undefined) patch.primaryColor = data.primary_color;
    if (data.accent_color !== undefined) patch.accentColor = data.accent_color;
    if (data.contact_email !== undefined) patch.contactEmail = data.contact_email;
    if (data.contact_phone !== undefined) patch.contactPhone = data.contact_phone;
    if (data.social_links !== undefined) patch.socialLinks = data.social_links;
    if (data.header_nav !== undefined) patch.headerNav = data.header_nav;
    if (data.footer_nav !== undefined) patch.footerNav = data.footer_nav;
    if (data.banners !== undefined) patch.banners = data.banners;
    if (data.announcement !== undefined) patch.announcement = data.announcement;
    if (data.seo !== undefined) patch.seo = data.seo;
    if (data.footer !== undefined) patch.footer = data.footer;

    const updated = await SiteSettings.findByIdAndUpdate(SITE_SETTINGS_ID, { $set: patch }, { new: true });
    return serializeSettings(updated);
  });
