import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_CURRENCY } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/integrations/mongodb/product.functions";
import { listActiveCategories } from "@/integrations/mongodb/category.functions";
import { getSiteSettings } from "@/integrations/mongodb/site-settings.functions";
import { siteSettingsQuery } from "@/hooks/use-site-settings";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { buildSeoHead } from "@/lib/seo";
import { getCanonicalOrigin } from "@/lib/canonical-origin.server";

export const Route = createFileRoute("/")({
  // This loader is the actual fix for the root cause: without it, the
  // homepage's body relied entirely on client-initiated useQuery calls,
  // which have no data on first render (isLoading: true, data: undefined)
  // regardless of whether they run during SSR streaming or after
  // hydration — nothing here previously guaranteed settings/products/
  // categories were ready before the page rendered. head() already got a
  // title from a real, awaited loader on the root route; the visible body
  // never had that same guarantee. This closes that asymmetry.
  loader: async () => {
    const [settings, featured, allProducts, categoriesRaw, canonicalOrigin] = await Promise.all([
      getSiteSettings().catch(() => null),
      listProducts({ data: { status: "active", featured: true, limit: 8 } }).catch(() => []),
      listProducts({ data: { status: "active", sort: "newest", limit: 8 } }).catch(() => []),
      listActiveCategories().catch(() => []),
      getCanonicalOrigin(),
    ]);
    const categories = categoriesRaw.slice(0, 6);
    return { settings, featured, allProducts, categories, canonicalOrigin };
  },
  head: ({ loaderData }) => {
    const settings = loaderData?.settings;
    const seo = settings?.seo as { title?: string; description?: string; og_image?: string } | undefined;
    // Priority order, matching the spec: admin-configured value first, then
    // a sensible generated fallback, generic platform text only as the
    // absolute last resort (and only when settings genuinely couldn't load).
    const title = seo?.title?.trim() || settings?.brand_name || "Online Store";
    const description = seo?.description?.trim() || settings?.tagline?.trim() || undefined;
    const image = seo?.og_image?.trim() || undefined;
    const url = loaderData?.canonicalOrigin ? `${loaderData.canonicalOrigin}/` : undefined;
    const { meta, links } = buildSeoHead({ title, description, image, url });
    return { meta, links };
  },
  component: HomePage,
});

function HomePage() {
  const loaderData = Route.useLoaderData();

  const { data: settings } = useQuery({ ...siteSettingsQuery, initialData: loaderData.settings ?? undefined });
  const banners = settings?.banners ?? [];
  const hero = banners[0];

  const { data: featured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => listProducts({ data: { status: "active", featured: true, limit: 8 } }),
    initialData: loaderData.featured,
  });

  const { data: allProducts } = useQuery({
    queryKey: ["products", "recent"],
    queryFn: () => listProducts({ data: { status: "active", sort: "newest", limit: 8 } }),
    initialData: loaderData.allProducts,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", "top"],
    queryFn: async () => (await listActiveCategories()).slice(0, 6),
    initialData: loaderData.categories,
  });

  const showFeatured = (featured?.length ?? 0) > 0 ? featured : allProducts;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section
          className="relative py-24 md:py-32 bg-gradient-to-br from-muted to-background overflow-hidden"
          style={hero?.image ? { backgroundImage: `url(${hero.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {hero?.image ? <div className="absolute inset-0 bg-black/40" /> : null}
          <div className="container mx-auto px-4 relative">
            <div className="max-w-2xl">
              <h1 className={`text-4xl md:text-6xl font-bold tracking-tight ${hero?.image ? "text-white" : ""}`}>
                {hero?.headline ?? `Welcome to ${settings?.brand_name ?? "our store"}`}
              </h1>
              <p className={`mt-4 text-lg ${hero?.image ? "text-white/90" : "text-muted-foreground"}`}>
                {hero?.subhead ?? settings?.tagline ?? "Discover our latest collection"}
              </p>
              <div className="mt-8">
                <Button asChild size="lg">
                  <a href={hero?.cta_url ?? "/shop"}>{hero?.cta_label ?? "Shop now"}</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {categories && categories.length > 0 ? (
          <section className="container mx-auto px-4 py-16">
            <h2 className="text-2xl font-bold mb-6">Shop by category</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to="/shop/$category"
                  params={{ category: c.slug }}
                  className="group block"
                >
                  <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-2">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {c.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-center">{c.name}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="container mx-auto px-4 py-16">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold">Featured products</h2>
            <Link to="/shop" className="text-sm underline">View all</Link>
          </div>
          {showFeatured && showFeatured.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {showFeatured.map((p: any) => (
                <ProductCard key={p.id} product={p} currency={settings?.currency ?? DEFAULT_CURRENCY} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No products yet. Add some from the admin panel.</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
