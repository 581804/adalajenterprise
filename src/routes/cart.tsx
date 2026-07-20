import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useSiteSettingsOptional } from "@/hooks/use-site-settings";
import { X } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const { data: settings } = useSiteSettingsOptional();
  const currency = settings?.currency ?? "USD";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Your cart</h1>
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Button asChild><Link to="/shop">Continue shopping</Link></Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={`${item.product_id}:${item.variant_id}`} className="flex gap-4 p-4 border rounded-lg">
                  <div className="w-24 h-24 rounded bg-muted overflow-hidden shrink-0">
                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" alt="" /> : null}
                  </div>
                  <div className="flex-1">
                    <Link to="/product/$slug" params={{ slug: item.slug }} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    {item.variant_name ? <div className="text-sm text-muted-foreground">{item.variant_name}</div> : null}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center border rounded">
                        <button className="px-2" onClick={() => setQty(item.product_id, item.variant_id, item.quantity - 1)}>-</button>
                        <span className="px-3">{item.quantity}</span>
                        <button className="px-2" onClick={() => setQty(item.product_id, item.variant_id, item.quantity + 1)}>+</button>
                      </div>
                      <button onClick={() => remove(item.product_id, item.variant_id)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold">{formatMoney(item.unit_price_cents * item.quantity, currency)}</div>
                </div>
              ))}
            </div>
            <aside className="p-6 border rounded-lg h-fit space-y-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
              </div>
              <div className="text-sm text-muted-foreground">Shipping and taxes calculated at checkout.</div>
              <Button asChild className="w-full" size="lg"><Link to="/checkout">Checkout</Link></Button>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
