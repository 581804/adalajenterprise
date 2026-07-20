import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  product_id: string;
  variant_id: string | null;
  title: string;
  variant_name?: string | null;
  unit_price_cents: number;
  quantity: number;
  image_url?: string | null;
  slug: string;
};

type CartCtx = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  add: (item: CartItem) => void;
  remove: (product_id: string, variant_id: string | null) => void;
  setQty: (product_id: string, variant_id: string | null, qty: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add: CartCtx["add"] = (item) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (p) => p.product_id === item.product_id && p.variant_id === item.variant_id,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
  };

  const remove: CartCtx["remove"] = (product_id, variant_id) =>
    setItems((prev) =>
      prev.filter((p) => !(p.product_id === product_id && p.variant_id === variant_id)),
    );

  const setQty: CartCtx["setQty"] = (product_id, variant_id, qty) =>
    setItems((prev) =>
      prev
        .map((p) =>
          p.product_id === product_id && p.variant_id === variant_id
            ? { ...p, quantity: Math.max(0, qty) }
            : p,
        )
        .filter((p) => p.quantity > 0),
    );

  const clear = () => setItems([]);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);

  return (
    <Ctx.Provider value={{ items, itemCount, subtotal, add, remove, setQty, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) return { items: [], itemCount: 0, subtotal: 0, add() {}, remove() {}, setQty() {}, clear() {} } as CartCtx;
  return ctx;
}
