// Server-only. Do not import from route files or client components.
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Postgres enforced a true singleton via `id int PRIMARY KEY DEFAULT 1 CHECK
// (id = 1)`. Mongo has no CHECK constraint, so the singleton-ness is enforced
// entirely in application code: always read/write via this fixed _id, never
// via User input, and never call SiteSettings.create() directly — use
// getOrCreateSiteSettings() below.
export const SITE_SETTINGS_ID = "000000000000000000000001";

const siteSettingsSchema = new Schema(
  {
    _id: { type: String, default: SITE_SETTINGS_ID },
    brandName: { type: String, required: true, default: "My Store" },
    tagline: { type: String, default: "" },
    logoUrl: { type: String },
    faviconUrl: { type: String },
    currency: { type: String, required: true, default: "INR" },
    currencySymbol: { type: String, required: true, default: "₹" },
    primaryColor: { type: String, required: true, default: "#0f172a" },
    accentColor: { type: String, required: true, default: "#f59e0b" },
    contactEmail: { type: String },
    contactPhone: { type: String },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    headerNav: { type: Schema.Types.Mixed, default: [] },
    footerNav: { type: Schema.Types.Mixed, default: [] },
    banners: { type: Schema.Types.Mixed, default: [] },
    announcement: {
      type: Schema.Types.Mixed,
      default: { enabled: false, text: "", link: "" },
    },
    seo: {
      type: Schema.Types.Mixed,
      default: { title: "My Store", description: "", og_image: "" },
    },
    footer: {
      type: Schema.Types.Mixed,
      default: {
        about: "",
        address: "",
        columns: [],
        newsletter: {
          enabled: false,
          heading: "Join our newsletter",
          subheading: "Get updates and offers.",
          placeholder: "you@example.com",
        },
        bottom_links: [],
        payment_badges: [],
        show_social: true,
        copyright: "",
      },
    },
  },
  { timestamps: { createdAt: false, updatedAt: true }, _id: false },
);

export type SiteSettingsDocument = InferSchemaType<typeof siteSettingsSchema>;

export const SiteSettings: Model<SiteSettingsDocument> =
  (mongoose.models.SiteSettings as Model<SiteSettingsDocument>) ||
  mongoose.model("SiteSettings", siteSettingsSchema);

/**
 * Always use this instead of SiteSettings.findById directly — creates the
 * singleton with defaults on first read if it doesn't exist yet, replacing
 * the original migration's `INSERT INTO site_settings (id) VALUES (1)`
 * seed statement (which only runs once, at migration time; this runs
 * lazily instead, which is more robust against a fresh Mongo instance that
 * never ran an equivalent seed step).
 */
export async function getOrCreateSiteSettings(): Promise<InstanceType<typeof SiteSettings>> {
  const existing = await SiteSettings.findById(SITE_SETTINGS_ID);
  if (existing) return existing;
  return SiteSettings.create({ _id: SITE_SETTINGS_ID });
}
