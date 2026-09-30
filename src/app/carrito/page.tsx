"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useCart, type CartItem } from "@/lib/cart";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function markingSummary(item: CartItem) {
  if (!item.marking) return "Pedido de stock, sin marcaje";
  const { technique, pecho, espalda, mangas } = item.marking;
  const zones = [
    pecho.active && `pecho ${pecho.size}`,
    espalda.active && `espalda ${espalda.size}`,
    mangas.active && `mangas ${mangas.size}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `${technique}${zones ? ` — ${zones}` : ""}`;
}

// Varias tallas del mismo producto+diseño añadidas juntas (ver
// AddToCartForm) comparten designGroupId — se muestran agrupadas bajo un
// solo bloque en vez de como líneas sueltas (petición del dueño,
// 2026-09-30). Los carritos guardados antes de este cambio no tienen
// designGroupId: cada línea cae en su propio grupo de una, sin romper nada.
function groupItems(items: CartItem[]): CartItem[][] {
  const groups = new Map<string, CartItem[]>();
  const order: string[] = [];
  items.forEach((item, idx) => {
    const key = item.designGroupId ?? `__solo_${idx}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  });
  return order.map((key) => groups.get(key)!);
}

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const groups = useMemo(() => groupItems(items), [items]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-ink">Tu carrito está vacío</h1>
        <p className="mt-3 text-ink-soft">Añade productos desde el catálogo para verlos aquí.</p>
        <Link
          href="/catalogo"
          className="mt-6 inline-flex cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-ink">Tu carrito</h1>

      <div className="mt-8 flex flex-col gap-4">
        {groups.map((group) => {
          const first = group[0];
          const groupTotal = group.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          const groupQuantity = group.reduce((sum, i) => sum + i.quantity, 0);

          return (
            <div key={first.id} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={first.design?.previewImageUrl ?? first.image}
                    alt={first.productName}
                    width={80}
                    height={80}
                    unoptimized
                    className="h-full w-full object-contain p-2"
                  />
                </div>
                <div className="flex-1">
                  <Link href={`/producto/${first.productSlug}`} className="font-display text-sm font-bold text-ink hover:text-brand">
                    {first.productName}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">{markingSummary(first)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-bold text-ink">{money(groupTotal)}</p>
                  <p className="text-xs text-ink-soft">{groupQuantity} uds en total</p>
                </div>
              </div>

              <div className="mt-3 flex flex-col divide-y divide-border border-t border-border">
                {group.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <span className="w-24 shrink-0 text-xs text-ink-soft">
                      {[item.size, item.color].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <label className="flex items-center gap-2 text-xs text-ink-soft">
                      Cantidad
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, Math.max(1, Number(e.target.value)))}
                        className="w-16 rounded-lg border border-border px-2 py-1 text-sm text-ink"
                      />
                    </label>
                    <span className="flex-1 text-right text-xs text-ink-soft">{money(item.unitPrice)}/ud</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="cursor-pointer text-xs font-semibold text-ink-soft hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-end gap-4 border-t border-border pt-6">
        <p className="text-lg font-bold text-ink">
          Subtotal: <span className="text-brand">{money(subtotal)}</span>
        </p>
        <p className="text-xs text-ink-soft">El IVA se calcula en el siguiente paso.</p>
        <Link
          href="/checkout"
          className="cursor-pointer rounded-full bg-brand px-8 py-3 text-center font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
        >
          Continuar al pago
        </Link>
      </div>
    </div>
  );
}
