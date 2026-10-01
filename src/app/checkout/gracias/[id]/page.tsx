import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderConfirmation } from "@/lib/orders";
import PurchasePixel from "@/components/PurchasePixel";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default async function GraciasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderConfirmation(id);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <PurchasePixel orderId={order.id} value={order.total} />
      <h1 className="text-3xl font-bold text-ink">¡Pedido recibido!</h1>
      <p className="mt-3 text-ink-soft">
        En breve te enviaremos el enlace de pago a <strong className="text-ink">{order.contactEmail}</strong>.
        El pedido no pasa a producción hasta confirmar el pago.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-white p-6 text-left">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Pedido</p>
        <p className="font-mono text-sm text-ink">{order.id}</p>

        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 text-sm">
          {order.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {line.previewImageUrl && (
                  <Image
                    src={line.previewImageUrl}
                    alt="Vista previa del diseño"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 shrink-0 rounded-lg border border-border object-contain"
                  />
                )}
                <div>
                  <p className="text-ink">
                    {line.quantity}× {line.productName}
                    {[line.size, line.color].filter(Boolean).length > 0 && (
                      <span className="text-ink-soft"> ({[line.size, line.color].filter(Boolean).join(" · ")})</span>
                    )}
                  </p>
                  {line.markingCost != null ? (
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Prenda {money(line.garmentCost ?? 0)}/ud + personalización {money(line.markingCost)}/ud ={" "}
                      {money(line.unitPrice)}/ud
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-ink-soft">{money(line.unitPrice)}/ud, sin marcaje</p>
                  )}
                </div>
              </div>
              <span className="shrink-0 font-semibold text-ink">{money(line.unitPrice * line.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm text-ink-soft">
          {order.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Descuento</span>
              <span>-{money(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Envío</span>
            <span>{order.shippingCost === 0 ? "Gratis" : money(order.shippingCost)}</span>
          </div>
        </div>

        <div className="mt-2 flex justify-between border-t border-border pt-4 font-display text-lg font-bold text-ink">
          <span>Total (IVA incl.)</span>
          <span>{money(order.total)}</span>
        </div>
      </div>

      <Link
        href="/catalogo"
        className="mt-8 inline-flex cursor-pointer rounded-full border border-border px-7 py-3 font-display text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
      >
        Seguir viendo catálogo
      </Link>
    </div>
  );
}
