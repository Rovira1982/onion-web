"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function markingSummary(item: ReturnType<typeof useCart>["items"][number]) {
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

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

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
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 rounded-2xl border border-border bg-white p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
              <Image
                src={item.design?.previewImageUrl ?? item.image}
                alt={item.productName}
                width={80}
                height={80}
                unoptimized
                className="h-full w-full object-contain p-2"
              />
            </div>
            <div className="flex-1">
              <Link href={`/producto/${item.productSlug}`} className="font-display text-sm font-bold text-ink hover:text-brand">
                {item.productName}
              </Link>
              <p className="mt-0.5 text-xs text-ink-soft">
                {[item.size, item.color].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-ink-soft">{markingSummary(item)}</p>
              <div className="mt-2 flex items-center gap-3">
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
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="cursor-pointer text-xs font-semibold text-ink-soft hover:text-red-600"
                >
                  Quitar
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-sm font-bold text-ink">{money(item.unitPrice * item.quantity)}</p>
              <p className="text-xs text-ink-soft">{money(item.unitPrice)}/ud</p>
            </div>
          </div>
        ))}
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
