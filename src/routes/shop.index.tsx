import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_CURRENCY } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listProducts } from "@/integrations/mongodb/product.functions";
import { listActiveCategories } from "@/integrations/mongodb/category.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { buildSeoHead } from "@/lib/seo";
import { getCanonicalOrigin } from "@/lib/canonical-origin.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/")({
  // Loader owns exactly the DEFAULT view (newest, all categories) — the
  // same query params the component's useQuery calls start with below.
  // This is what a crawler with no JS actually sees. Once the person
  // interacts with the sort/category filters client-side, useQuery takes
  // over re-fetching for that — a genuine post-load interaction, not an
  // SSR/crawler concern, so it correctly stays client-driven.
  loader: async () => {
    const [products, categories, canonicalOrigin] = await Promise.all([
      listProducts({ data: { status: "active", sort: "newest", limit: 60 } }).catch(() => []),
      listActiveCategories().catch(() => []),
      getCanonicalOrigin(),
    ]);
    return { products, categories, canonicalOrigin };
  },
  head: ({ loaderData }) => {
    const url = loaderData?.canonicalOrigin ? `${loaderData.canonicalOrigin}/shop` : undefined;
    const { meta, links } = buildSeoHead({ title: "Shop — All Products", url });
    return { meta, links };
  },
  component: ShopIndex,
});

function ShopIndex() {
  const loaderData = Route.useLoaderData();
  const { data: settings } = useSiteSettingsOptional();
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: categories } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => listActiveCategories(),
    initialData: loaderData.categories,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "shop", sort, categoryId],
    queryFn: () =>
      listProducts({
        data: { status: "active", sort, categoryId: categoryId !== "all" ? categoryId : undefined, limit: 60 },
      }),
    // initialData only applies to the query's exact starting key (newest +
    // all categories) — once sort/categoryId change client-side, the key
    // changes and React Query correctly fetches fresh rather than reusing
    // stale loader data for a different filter combination.
    initialData: sort === "newest" && categoryId === "all" ? loaderData.products : undefined,
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
              <ProductCard key={p.id} product={p} currency={settings?.currency ?? DEFAULT_CURRENCY} />
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
