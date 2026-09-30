"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { crearPedido, comprobarCodigoDescuento } from "./actions";
import type { DiscountCheckResult } from "@/lib/discounts";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const PAYMENT_METHODS: { value: "tarjeta" | "bizum" | "transferencia"; label: string }[] = [
  { value: "tarjeta", label: "Tarjeta" },
  { value: "bizum", label: "Bizum" },
  { value: "transferencia", label: "Transferencia" },
];

// Envío al cliente — 6€ fijo, gratis desde 300€ de importe final (con
// descuento e IVA incluidos, sin contar el propio envío). Debe coincidir
// exactamente con la regla del servidor en checkout/actions.ts — esto es
// solo la vista previa, el pedido real se recalcula ahí.
const SHIPPING_COST = 6;
const FREE_SHIPPING_THRESHOLD = 300;

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();

  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceTaxId, setInvoiceTaxId] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");
  const [invoicePostalCode, setInvoicePostalCode] = useState("");
  const [invoiceCity, setInvoiceCity] = useState("");
  const [invoiceProvince, setInvoiceProvince] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"tarjeta" | "bizum" | "transferencia">("tarjeta");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [discountResult, setDiscountResult] = useState<DiscountCheckResult | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const discountAmount = discountResult?.valid ? discountResult.discountAmount : 0;
  const subtotalConDescuento = subtotal - discountAmount;
  const vat = subtotalConDescuento * 0.21;
  const totalBeforeShipping = subtotalConDescuento + vat;
  const shippingCost = totalBeforeShipping >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = totalBeforeShipping + shippingCost;

  async function handleAplicarCodigo() {
    if (!discountCodeInput.trim()) return;
    setCheckingCode(true);
    const result = await comprobarCodigoDescuento(discountCodeInput, subtotal, contactEmail);
    setDiscountResult(result);
    setCheckingCode(false);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-ink">Tu carrito está vacío</h1>
        <Link
          href="/catalogo"
          className="mt-6 inline-flex cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await crearPedido({
      items: items.map((i) => ({
        productVariantId: i.productVariantId,
        quantity: i.quantity,
        marking: i.marking,
        design: i.design,
      })),
      invoiceName,
      invoiceTaxId,
      invoiceAddress,
      invoicePostalCode,
      invoiceCity,
      invoiceProvince,
      contactEmail,
      contactPhone,
      paymentMethod,
      discountCode: discountResult?.valid ? discountCodeInput : undefined,
    });

    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    clear();
    router.push(`/checkout/gracias/${result.orderId}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-ink">Finalizar pedido</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">Nombre o razón social *</span>
              <input
                required
                value={invoiceName}
                onChange={(e) => setInvoiceName(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">NIF / CIF *</span>
              <input
                required
                value={invoiceTaxId}
                onChange={(e) => setInvoiceTaxId(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="font-display text-sm font-semibold text-ink">Dirección *</span>
            <input
              required
              value={invoiceAddress}
              onChange={(e) => setInvoiceAddress(e.target.value)}
              placeholder="Calle, número, piso"
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">Código postal *</span>
              <input
                required
                value={invoicePostalCode}
                onChange={(e) => setInvoicePostalCode(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">Población *</span>
              <input
                required
                value={invoiceCity}
                onChange={(e) => setInvoiceCity(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">Provincia *</span>
              <input
                required
                value={invoiceProvince}
                onChange={(e) => setInvoiceProvince(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">Email *</span>
              <input
                required
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink">Teléfono</span>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
          </div>

          <div>
            <span className="font-display text-sm font-semibold text-ink">Método de pago preferido</span>
            <div className="mt-2 flex gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex-1 cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    paymentMethod === m.value ? "border-brand bg-brand text-white" : "border-border text-ink-soft hover:border-brand"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Todavía no cobramos online desde la web — te enviaremos el enlace de pago por email en cuanto confirmes el pedido.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando pedido…" : "Confirmar pedido"}
          </button>
        </form>

        <aside className="h-fit rounded-2xl border border-border bg-white p-5">
          <h2 className="font-display text-sm font-bold text-ink">Resumen</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.quantity}× {item.productName}
                </span>
                <span className="shrink-0 font-semibold text-ink">{money(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <span className="font-display text-xs font-semibold uppercase tracking-wide text-ink-soft">
              ¿Tienes un código?
            </span>
            <div className="flex gap-2">
              <input
                value={discountCodeInput}
                onChange={(e) => {
                  setDiscountCodeInput(e.target.value);
                  setDiscountResult(null);
                }}
                placeholder="CÓDIGO"
                className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm uppercase text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="button"
                onClick={handleAplicarCodigo}
                disabled={checkingCode || !discountCodeInput.trim()}
                className="shrink-0 cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingCode ? "…" : "Aplicar"}
              </button>
            </div>
            {discountResult && !discountResult.valid && (
              <p className="text-xs text-red-600">{discountResult.error}</p>
            )}
            {discountResult?.valid && (
              <p className="text-xs font-semibold text-green-700">
                Código aplicado: -{discountResult.percentage}%
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Descuento</span>
                <span>-{money(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink-soft">
              <span>IVA (21%)</span>
              <span>{money(vat)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Envío</span>
              <span>{shippingCost === 0 ? "Gratis" : money(shippingCost)}</span>
            </div>
            {shippingCost > 0 && (
              <p className="text-xs text-ink-soft">
                Envío gratis a partir de {money(FREE_SHIPPING_THRESHOLD)} (te faltan{" "}
                {money(FREE_SHIPPING_THRESHOLD - totalBeforeShipping)})
              </p>
            )}
            <div className="flex justify-between font-display text-base font-bold text-ink">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
