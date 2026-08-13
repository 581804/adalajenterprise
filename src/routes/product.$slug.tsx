import { createFileRoute, notFound } from "@tanstack/react-router";
import { DEFAULT_CURRENCY } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getProductBySlug } from "@/integrations/mongodb/product.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { formatMoney } from "@/lib/format";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { SanitizedHtml } from "@/components/sanitized-html";
import { buildSeoHead, stripHtmlForMeta } from "@/lib/seo";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const product = await getProductBySlug({ data: { slug: params.slug } });
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    if (!product) return {};
    const seo = (product.seo ?? {}) as { title?: string; description?: string };
    const title = seo.title?.trim() || product.title;
    const description =
      seo.description?.trim() ||
      product.short_description?.trim() ||
      (product.description ? stripHtmlForMeta(product.description) : undefined);
    const image = product.images?.[0] ?? undefined;
    const { meta, links } = buildSeoHead({ title, description, image, type: "product" });
    return { meta, links };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { add } = useCart();
  const { data: settings } = useSiteSettingsOptional();
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const loaderData = Route.useLoaderData();
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    initialData: loaderData.product,
    queryFn: async () => {
      const result = await getProductBySlug({ data: { slug } });
      if (!result) throw notFound();
      return result;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto p-8">Loading…</main>
      </div>
    );
  }
  if (!product) return null;

  const images = Array.isArray(product.images) ? product.images : [];
  const variant = product.product_variants?.find((v: any) => v.id === selectedVariant);
  const price = variant?.price_cents ?? product.price_cents;
  const stock = variant ? variant.stock : product.stock;
  const currency = product.currency ?? settings?.currency ?? DEFAULT_CURRENCY;
  const heroImg: any = images[selectedImage];

  const handleAdd = () => {
    if (product.product_variants?.length > 0 && !selectedVariant) {
      toast.error("Please select a variant");
      return;
    }
    add({
      product_id: product.id,
      variant_id: selectedVariant,
      title: product.title,
      variant_name: variant?.name ?? null,
      unit_price_cents: price,
      quantity: qty,
      image_url: heroImg ? (typeof heroImg === "string" ? heroImg : heroImg.url) : null,
      slug: product.slug,
    });
    toast.success("Added to cart");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <div className="aspect-square rounded-lg bg-muted overflow-hidden">
              {heroImg ? (
                <img
                  src={typeof heroImg === "string" ? heroImg : heroImg.url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="grid grid-cols-5 gap-2 mt-2">
                {images.map((img: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`aspect-square rounded overflow-hidden border-2 ${
                      i === selectedImage ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={typeof img === "string" ? img : img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{product.title}</h1>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-semibold">{formatMoney(price, currency)}</span>
              {product.compare_at_cents && product.compare_at_cents > price ? (
                <span className="text-lg text-muted-foreground line-through">
                  {formatMoney(product.compare_at_cents, currency)}
                </span>
              ) : null}
            </div>
            {product.short_description ? (
              <p className="mt-4 text-muted-foreground">{product.short_description}</p>
            ) : null}

            {product.product_variants && product.product_variants.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-medium mb-2">Options</div>
                <div className="flex flex-wrap gap-2">
                  {product.product_variants.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className={`px-4 py-2 rounded border ${
                        selectedVariant === v.id ? "border-primary bg-primary/10" : ""
                      } ${v.stock <= 0 ? "opacity-50" : ""}`}
                      disabled={v.stock <= 0}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border rounded">
                <button className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
                <input
                  className="w-12 text-center bg-transparent outline-none"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button className="px-3 py-2" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
              <Button size="lg" onClick={handleAdd} disabled={stock <= 0}>
                {stock <= 0 ? "Out of stock" : "Add to cart"}
              </Button>
            </div>

            {product.description ? (
              <div className="mt-8 prose prose-sm max-w-none">
                <h3 className="font-semibold mb-2">Description</h3>
                <SanitizedHtml html={product.description} className="text-muted-foreground" />
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
