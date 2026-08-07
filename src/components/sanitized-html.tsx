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

/**
 * Renders a sanitized rich-text field (product descriptions, etc). Safe to
 * use with admin-authored HTML — the sanitizer runs on every render, so
 * even if something unsanitized ever ends up in the database (a future
 * code path that forgets to sanitize on write, a direct DB edit, etc.),
 * this component is still the actual point of protection, not a
 * second layer relying on data always being clean by the time it gets here.
 */
export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeDescriptionHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
