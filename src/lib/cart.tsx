"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type QuoteInput } from "@/lib/pricing";
import { personalizedUnitPrice } from "@/lib/line-price";
import { selectGarmentTier, type GarmentPriceInput, type GarmentTier } from "@/lib/garment-price";
import { groupQuantityTotals } from "@/lib/design-group";

// A cart line is either a plain "stock" purchase (marking: null, price is the
// variant's own price) or a personalized one (marking holds the full
// QuoteInput used to price it). The server always recomputes the price from
// this configuration at checkout — unitPrice here is for display only.
export type CartDesign = {
  logoFileUrl: string;
  // One transform per active marking zone (pecho/espalda/mangas) — each gets
  // its own mockup view, so each needs its own position/scale/rotation.
  markings: Partial<
    Record<
      "pecho" | "espalda" | "manga_izquierda" | "manga_derecha",
      { x: number; y: number; scale: number; rotation: number; colorName?: string }
    >
  >;
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
  // Garment tier pricing (unidad/pack/caja) — maestro de precios,
  // 2026-09-30. `garment` carries what's needed to recompute the tier on a
  // quantity change; `garmentTier` is the tier applied at the current
  // quantity, shown to the customer and saved on the order line.
  garment: GarmentPriceInput;
  garmentTier: GarmentTier;
  marking: QuoteInput | null;
  design: CartDesign | null;
  // Varias tallas del mismo producto+diseño añadidas juntas comparten este
  // id (ver AddToCartForm) — el precio de marcaje se calcula sobre la
  // cantidad TOTAL del grupo, nunca sobre la de una talla sola (petición
  // del dueño, 2026-09-30: hoy cada talla se cobraba el marcaje como si
  // fuera un pedido aparte). Undefined en carritos guardados antes de este
  // cambio — se tratan como grupo de una sola línea.
  designGroupId?: string;
  // Código de pack de precio cerrado (ver src/lib/packs.ts), si esta línea
  // viene de /packs — checkout ignora unitPrice/marking para el precio real
  // y usa el total fijo del pack en su lugar. unitPrice aquí es solo el
  // reparto orientativo para mostrar en el carrito.
  packCode?: string;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => void;
  addItems: (items: Omit<CartItem, "id">[]) => void;
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

  // Same as addItem but for several sizes of the same product+design added
  // in one "Añadir al carrito" click (see AddToCartForm) — kept as one state
  // update so the cart is never rendered mid-way with only some sizes added.
  const addItems = useCallback((newItems: Omit<CartItem, "id">[]) => {
    setItems((prev) => [...prev, ...newItems.map((item) => ({ ...item, id: crypto.randomUUID() }))]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Both the garment tier (unidad/pack/caja) and the marking price depend on
  // quantity, so a quantity change must re-price locally too — otherwise the
  // cart total would drift from what checkout actually recalculates. When
  // the edited line shares a designGroupId with others (several sizes of the
  // same personalization), the WHOLE group must be repriced together: the
  // marking tier depends on the group's total quantity, so bumping one
  // size's quantity can change the per-unit marking price for every size in
  // the group, not just the one being edited.
  const updateQuantity = useCallback((id: string, quantity: number) => {
    const safeQuantity = Math.max(1, quantity);
    setItems((prev) => {
      const withNewQuantity = prev.map((i) => (i.id === id ? { ...i, quantity: safeQuantity } : i));
      // Recompute every line's group total, not just the edited one's — a
      // sibling line's own quantity didn't change, but its group total (and
      // therefore its marking price) may have.
      const groupTotals = groupQuantityTotals(withNewQuantity);

      return withNewQuantity.map((i, idx) => {
        // Packs de precio cerrado no se editan línea a línea (ver
        // carrito/page.tsx, que ya no expone el input de cantidad para
        // ellos) — si algo llegara a invocar esto de todas formas, no hay
        // fórmula de repreciado válida para un pack, así que no se toca.
        if (i.packCode) return i;
        const garmentPricing = selectGarmentTier(i.garment, i.quantity);
        if (!i.marking) {
          return { ...i, unitPrice: garmentPricing.price, garmentTier: garmentPricing.tier };
        }
        const marking = { ...i.marking, quantity: groupTotals[idx], garmentUnitCost: garmentPricing.price };
        const unitPrice = personalizedUnitPrice(marking, garmentPricing.price);
        // Some technique/quantity combinations have no set price yet
        // (Serigrafía under 10 units total) — keep this line as it was
        // rather than showing a broken/zeroed price; checkout would reject
        // it anyway.
        if (unitPrice === null) return prev[idx];
        return { ...i, marking, unitPrice, garmentTier: garmentPricing.tier };
      });
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, addItems, removeItem, updateQuantity, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
