import sanitizeHtml from "sanitize-html";

export type SeoInput = {
  title: string;
  description?: string;
  image?: string | null;
  url?: string;
  type?: "website" | "product" | "article";
};

/**
 * Builds a consistent meta/link array for a route's head(). Centralizing
 * this is the actual fix for the root cause of the "every page looks
 * identical to Google" problem — previously every route either had no
 * head() at all (inheriting the root's hardcoded title/description) or
 * would have had to hand-roll the same 10-line meta array individually,
 * which is exactly how a stale image URL and identical title ended up on
 * every single page in the first place.
 */
export function buildSeoHead({ title, description, image, url, type = "website" }: SeoInput) {
  const desc = description?.trim() || undefined;
  const meta: Array<Record<string, string>> = [
    { title },
    ...(desc ? [{ name: "description", content: desc }] : []),
    { property: "og:type", content: type },
    { property: "og:title", content: title },
    ...(desc ? [{ property: "og:description", content: desc }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    ...(desc ? [{ name: "twitter:description", content: desc }] : []),
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }
  if (url) {
    meta.push({ property: "og:url", content: url });
  }
  const links = url ? [{ rel: "canonical", href: url }] : [];
  return { meta, links };
}

/**
 * Converts a rich-text (HTML) description into plain text suitable for a
 * <meta name="description"> tag — meta tags can't contain markup, and
 * Google truncates descriptions past ~160 characters anyway, so this both
 * strips tags and caps length rather than dumping raw HTML into the head.
 * Verified against real multi-block HTML before use: without inserting a
 * line break at block boundaries, sanitize-html's plain-text output runs
 * adjacent paragraphs/list items together with no separating space.
 */
export function stripHtmlForMeta(html: string, maxLength = 160): string {
  const withBreaks = html.replace(/<\/(p|div|li|h[1-6]|br)>/gi, "$&\n");
  const stripped = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  const normalized = stripped.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength - 1).trim() + "…" : normalized;
}
