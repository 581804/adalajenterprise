import { createFileRoute, notFound } from "@tanstack/react-router";
import { DEFAULT_CURRENCY } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { getCategoryBySlug } from "@/integrations/mongodb/category.functions";
import { listProducts } from "@/integrations/mongodb/product.functions";
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
      const result = await getCategoryBySlug({ data: { slug: category } });
      if (!result) throw notFound();
      return result;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products", "cat", cat?.id],
    enabled: !!cat?.id,
    queryFn: () => listProducts({ data: { status: "active", categoryId: cat!.id, sort: "newest" } }),
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
              <ProductCard key={p.id} product={p} currency={settings?.currency ?? DEFAULT_CURRENCY} />
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
