"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { calculateQuote, type QuoteInput } from "@/lib/pricing";

// A cart line is either a plain "stock" purchase (marking: null, price is the
// variant's own price) or a personalized one (marking holds the full
// QuoteInput used to price it). The server always recomputes the price from
// this configuration at checkout — unitPrice here is for display only.
export type CartDesign = {
  logoFileUrl: string;
  // One transform per active marking zone (pecho/espalda/mangas) — each gets
  // its own mockup view, so each needs its own position/scale/rotation.
  markings: Partial<Record<"pecho" | "espalda" | "mangas", { x: number; y: number; scale: number; rotation: number }>>;
  previewImageUrl: string;
};

export type CartItem = {
  id: string;
  productVariantId: string;
  productSlug: string;
  productName: string;
  size: string;
  color: string;
  image: string;
  quantity: number;
  unitPrice: number;
  marking: QuoteInput | null;
  design: CartDesign | null;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "onion-cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Cart lives in localStorage, so it can't be read during SSR — load it
  // after mount and only start persisting once that initial load has run
  // (otherwise the very first render would overwrite storage with []).
  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable (private browsing) — cart just won't persist.
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    setItems((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Personalized items price by quantity tier (technique floor, bulk
  // discount), so a quantity change must re-price locally too — otherwise
  // the cart total would drift from what checkout actually recalculates.
  const updateQuantity = useCallback((id: string, quantity: number) => {
    const safeQuantity = Math.max(1, quantity);
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (!i.marking) return { ...i, quantity: safeQuantity };
        const marking = { ...i.marking, quantity: safeQuantity };
        return { ...i, quantity: safeQuantity, marking, unitPrice: calculateQuote(marking).finalUnitPrices.recommended };
      })
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
