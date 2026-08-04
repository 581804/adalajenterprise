// Single source of truth for this store's default currency. Every fallback
// in the app should read from here, not hardcode its own literal — that's
// exactly how nine separate "USD" defaults ended up scattered across the
// codebase previously. The *authoritative* value for a live store is always
// SiteSettings.currency (configurable via Admin > Branding); this constant
// is only the safety-net fallback for the rare case settings haven't loaded
// yet, or a document predates a currency field being set at all.
export const DEFAULT_CURRENCY = "INR";
export const DEFAULT_CURRENCY_SYMBOL = "₹";

export function formatMoney(cents: number, currency = DEFAULT_CURRENCY, symbol = DEFAULT_CURRENCY_SYMBOL) {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${symbol}${value.toFixed(2)}`;
  }
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
