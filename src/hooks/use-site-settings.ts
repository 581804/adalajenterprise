import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { getSiteSettings } from "@/integrations/mongodb/site-settings.functions";

export type FooterColumn = { title: string; links: Array<{ label: string; url: string }> };
export type FooterConfig = {
  about: string;
  address: string;
  columns: FooterColumn[];
  newsletter: { enabled: boolean; heading: string; subheading: string; placeholder: string };
  bottom_links: Array<{ label: string; url: string }>;
  payment_badges: string[];
  show_social: boolean;
  copyright: string;
};

export type SiteSettings = {
  id: number;
  brand_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  currency: string;
  currency_symbol: string;
  primary_color: string;
  accent_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  social_links: Record<string, string>;
  header_nav: Array<{ label: string; url: string }>;
  footer_nav: Array<{ label: string; url: string }>;
  banners: Array<{ image?: string; headline?: string; subhead?: string; cta_label?: string; cta_url?: string }>;
  announcement: { enabled: boolean; text: string; link?: string };
  seo: { title?: string; description?: string; og_image?: string };
  footer: FooterConfig;
};

async function fetchSiteSettings(): Promise<SiteSettings> {
  return getSiteSettings() as unknown as Promise<SiteSettings>;
}

export const siteSettingsQuery = {
  queryKey: ["site_settings"],
  queryFn: fetchSiteSettings,
  staleTime: 60_000,
};

export function useSiteSettings() {
  return useSuspenseQuery(siteSettingsQuery);
}

export function useSiteSettingsOptional() {
  return useQuery(siteSettingsQuery);
}
