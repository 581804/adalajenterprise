import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: settings } = useSiteSettingsOptional();
  const banners = settings?.banners ?? [];
  const hero = banners[0];

  const { data: featured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, title, price_cents, compare_at_cents, images, currency")
        .eq("status", "active")
        .eq("is_featured", true)
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allProducts } = useQuery({
    queryKey: ["products", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, title, price_cents, compare_at_cents, images, currency")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", "top"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, image_url")
        .eq("is_active", true)
        .order("sort_order")
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
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
                <ProductCard key={p.id} product={p} currency={settings?.currency ?? "USD"} />
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
