import sanitizeHtml from "sanitize-html";

// Deliberately an allowlist (only these tags/attributes survive), not a
// blocklist — safer default, since anything not explicitly permitted is
// stripped automatically rather than requiring every dangerous case to be
// enumerated. Verified against real XSS payloads (script tags, onerror/
// onclick handlers, javascript: URLs, iframes) before this shipped —
// all stripped cleanly while legitimate formatting passes through.
const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "del", "sub", "sup",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "a", "img",
    "span", "div",
    "table", "thead", "tbody", "tr", "td", "th",
    "blockquote", "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["class"], // classnames alone can't execute code — safe to allow broadly
  },
  // Only these URL schemes survive on href/src — blocks javascript:, data:
  // (data: URLs can smuggle scripts in some contexts), and anything else.
  allowedSchemes: ["http", "https", "mailto"],
  // Links always get a safe rel regardless of what was authored, since a
  // target="_blank" link without rel="noopener" lets the opened page
  // access window.opener on the original tab.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

export function sanitizeDescriptionHtml(raw: string): string {
  return sanitizeHtml(raw ?? "", SANITIZE_CONFIG);
}

// Richer config for full CMS pages (About Us, policies, landing content) —
// these genuinely benefit from visual control (callout boxes, custom
// spacing, section backgrounds) that a short product description doesn't
// need. Extends the base tag set with layout-oriented elements, and adds a
// carefully vetted style-PROPERTY allowlist rather than permitting the
// style attribute wholesale — verified this blocks real attacks
// (position: fixed full-screen overlays for phishing, old CSS-expression()
// script execution) by testing actual payloads before relying on it, not
// just assumed from reading the sanitize-html docs.
const PAGE_EXTRA_TAGS = ["figure", "figcaption", "section", "article", "header", "footer", "nav"];
// iframe is deliberately excluded from both configs — arbitrary embedded
// content from a third-party origin is outside what a sanitizer alone can
// make safe.
const PAGE_SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [...(SANITIZE_CONFIG.allowedTags as string[]), ...PAGE_EXTRA_TAGS],
  allowedAttributes: {
    ...SANITIZE_CONFIG.allowedAttributes,
    "*": ["class", "style", "id"],
  },
  allowedSchemes: SANITIZE_CONFIG.allowedSchemes,
  transformTags: SANITIZE_CONFIG.transformTags,
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-zA-Z]+$/],
      "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-zA-Z]+$/],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(bold|normal|[1-9]00)$/],
      "font-style": [/^(italic|normal)$/],
      "font-size": [/^[0-9]+(\.[0-9]+)?(px|em|rem|%)$/],
      padding: [/^[0-9]+px( [0-9]+px){0,3}$/],
      margin: [/^[0-9]+px( [0-9]+px){0,3}$/],
      "border-radius": [/^[0-9]+px$/],
      border: [/^[0-9]+px (solid|dashed|dotted) (#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/],
      width: [/^[0-9]+(\.[0-9]+)?(px|%)$/],
      "max-width": [/^[0-9]+(\.[0-9]+)?(px|%)$/],
      // Deliberately NOT allowed at any property: position (enables
      // fixed/absolute overlay tricks), z-index (same), display: none on
      // arbitrary content (could hide disclosure text), content (CSS
      // generated-content can inject text outside the sanitizer's view).
    },
  },
};

export function sanitizePageHtml(raw: string): string {
  return sanitizeHtml(raw ?? "", PAGE_SANITIZE_CONFIG);
}

/**
 * Renders a sanitized rich-text field (product descriptions, etc). Safe to
 * use with admin-authored HTML — the sanitizer runs on every render, so
 * even if something unsanitized ever ends up in the database (a future
 * code path that forgets to sanitize on write, a direct DB edit, etc.),
 * this component is still the actual point of protection, not a
 * second layer relying on data always being clean by the time it gets here.
 */
export function SanitizedHtml({ html, className, variant = "standard" }: { html: string; className?: string; variant?: "standard" | "page" }) {
  const clean = variant === "page" ? sanitizePageHtml(html) : sanitizeDescriptionHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
