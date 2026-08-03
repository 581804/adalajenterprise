import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listProducts } from "@/integrations/mongodb/product.functions";
import { listActiveCategories } from "@/integrations/mongodb/category.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/")({
  component: ShopIndex,
});

function ShopIndex() {
  const { data: settings } = useSiteSettingsOptional();
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: categories } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => listActiveCategories(),
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "shop", sort, categoryId],
    queryFn: () =>
      listProducts({
        data: { status: "active", sort, categoryId: categoryId !== "all" ? categoryId : undefined, limit: 60 },
      }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold">Shop</h1>
          <div className="flex gap-2">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_asc">Price ↑</SelectItem>
                <SelectItem value="price_desc">Price ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {categories && categories.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-6 text-sm">
            {categories.map((c) => (
              <Link key={c.id} to="/shop/$category" params={{ category: c.slug }} className="px-3 py-1 rounded-full border hover:bg-muted">
                {c.name}
              </Link>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} currency={settings?.currency ?? "USD"} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No products yet.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
