// Server-only.
//
// Deliberately NOT a static file: a sitemap needs to reflect real, current
// content (products/categories/pages), which changes constantly as an
// admin adds/edits/removes them. Generating this dynamically from the live
// database means it's always correct with zero admin action required —
// nothing to remember to update, no separate "regenerate sitemap" step.
export async function handleSitemapRequest(url: URL): Promise<Response> {
  try {
    const { connectMongo } = await import("../integrations/mongodb/client.server");
    const { Product } = await import("../integrations/mongodb/models/product.server");
    const { Category } = await import("../integrations/mongodb/models/category.server");
    const { Page } = await import("../integrations/mongodb/models/page.server");
    await connectMongo();

    const origin = `${url.protocol}//${url.host}`;

    const [products, categories, pages] = await Promise.all([
      Product.find({ status: "active" }).select("slug updatedAt").lean(),
      Category.find({ isActive: true }).select("slug updatedAt").lean(),
      Page.find({ isPublished: true }).select("slug updatedAt").lean(),
    ]);

    const urls: Array<{ loc: string; lastmod?: Date; priority: string; changefreq: string }> = [
      { loc: `${origin}/`, priority: "1.0", changefreq: "daily" },
      { loc: `${origin}/shop`, priority: "0.9", changefreq: "daily" },
      ...products.map((p) => ({
        loc: `${origin}/product/${p.slug}`,
        lastmod: p.updatedAt,
        priority: "0.8",
        changefreq: "weekly",
      })),
      ...categories.map((c) => ({
        loc: `${origin}/shop/${c.slug}`,
        lastmod: c.updatedAt,
        priority: "0.7",
        changefreq: "weekly",
      })),
      ...pages.map((p) => ({
        loc: `${origin}/pages/${p.slug}`,
        lastmod: p.updatedAt,
        priority: "0.5",
        changefreq: "monthly",
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>\n` : ""}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        // Cached briefly at the edge — catalog content doesn't change so
        // often that every crawler request needs a fresh DB round-trip,
        // but short enough that a new product shows up within minutes.
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    // A broken sitemap request should not look like the whole site is
    // down — return a minimal, valid (if incomplete) sitemap rather than
    // a 500, so at least the homepage stays discoverable.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${escapeXml(`${url.protocol}//${url.host}/`)}</loc></url>\n</urlset>`,
      { headers: { "content-type": "application/xml; charset=utf-8" } },
    );
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
