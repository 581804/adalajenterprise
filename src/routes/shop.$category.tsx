import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";

export const Route = createFileRoute("/shop/$category")({
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const { data: settings } = useSiteSettingsOptional();

  const { data: cat } = useQuery({
    queryKey: ["category", category],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("slug", category).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products", "cat", cat?.id],
    enabled: !!cat?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, title, price_cents, compare_at_cents, images, currency")
        .eq("status", "active")
        .eq("category_id", cat!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">{cat?.name ?? category}</h1>
        {cat?.description ? <p className="text-muted-foreground mb-6">{cat.description}</p> : null}
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} currency={settings?.currency ?? "USD"} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No products in this category yet.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
