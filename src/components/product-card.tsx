import { Link } from "@tanstack/react-router";
import { formatMoney, DEFAULT_CURRENCY } from "@/lib/format";

type P = {
  product: {
    id: string;
    slug: string;
    title: string;
    price_cents: number;
    compare_at_cents: number | null;
    images: any;
    currency?: string;
  };
  currency?: string;
};

export function ProductCard({ product, currency = DEFAULT_CURRENCY }: P) {
  const img = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
  return (
    <Link to="/product/$slug" params={{ slug: product.slug }} className="group block">
      <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-3">
        {img ? (
          <img
            src={typeof img === "string" ? img : img.url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
      </div>
      <h3 className="font-medium line-clamp-2">{product.title}</h3>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-semibold">{formatMoney(product.price_cents, product.currency ?? currency)}</span>
        {product.compare_at_cents && product.compare_at_cents > product.price_cents ? (
          <span className="text-sm text-muted-foreground line-through">
            {formatMoney(product.compare_at_cents, product.currency ?? currency)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
