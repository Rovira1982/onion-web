import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { requireAdmin } from "@/lib/auth";
import { getFactusolClientCode } from "@/lib/factusol";
import MarcarPagadoButton from "./MarcarPagadoButton";
import ArchivarDisenoButton from "./ArchivarDisenoButton";
import CodigoFactusolField from "./CodigoFactusolField";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default async function AdminPedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  const factusolCode = await getFactusolClientCode(order.invoiceTaxId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin/pedidos" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Volver a pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Pedido {order.id.slice(0, 8)}</h1>
        {order.paymentStatus === "pagado" ? (
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">Pagado</span>
        ) : (
          <MarcarPagadoButton orderId={order.id} />
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-display font-semibold text-ink-soft">Estado</dt>
          <dd className="mt-1 text-ink">{order.status}</dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-ink-soft">Pago</dt>
          <dd className="mt-1 text-ink">
            {order.paymentStatus} · {order.paymentMethod}
          </dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-ink-soft">Fecha</dt>
          <dd className="mt-1 text-ink">{order.createdAt.toLocaleDateString("es-ES")}</dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-ink-soft">Cliente</dt>
          <dd className="mt-1 text-ink">{order.invoiceName}</dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-ink-soft">NIF/CIF</dt>
          <dd className="mt-1 text-ink">{order.invoiceTaxId}</dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-ink-soft">Código cliente FactuSol</dt>
          <dd className="mt-1">
            <CodigoFactusolField nif={order.invoiceTaxId} currentCode={factusolCode} />
          </dd>
        </div>
        <div>
          <dt className="font-display font-semibold text-ink-soft">Contacto</dt>
          <dd className="mt-1 text-ink">
            {order.contactEmail}
            {order.contactPhone ? ` · ${order.contactPhone}` : ""}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="font-display font-semibold text-ink-soft">Dirección de facturación</dt>
          <dd className="mt-1 text-ink">
            {order.invoiceAddress}, {order.invoicePostalCode} {order.invoiceCity} ({order.invoiceProvince})
          </dd>
        </div>
      </dl>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-ink-soft">
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Talla/Color</th>
              <th className="px-4 py-2">Tramo</th>
              <th className="px-4 py-2">Cant.</th>
              <th className="px-4 py-2">Prenda/ud</th>
              <th className="px-4 py-2">Marcaje/ud</th>
              <th className="px-4 py-2">Precio/ud</th>
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-border">
                <td className="px-4 py-2 text-ink">
                  {line.productName}
                  {line.marks.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                      {line.marks.map((m) => (
                        <li key={m.zone}>
                          <span className="font-semibold text-ink">{m.zone.replace("_", " ")}</span> · {m.technique}
                          {m.size ? ` ${m.size}` : m.colors ? ` ${m.colors} col.` : ""} · tramo {m.tierQty}+ ·{" "}
                          <span className={m.colorName ? "font-semibold text-brand-dark" : ""}>
                            {m.colorName ? `color: ${m.colorName}` : "color sin indicar"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {line.previewImageUrl && (
                    <div className="mt-1">
                      <ArchivarDisenoButton orderLineId={line.id} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-ink-soft">{[line.size, line.color].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-2 text-ink-soft">{line.priceTier ?? "—"}</td>
                <td className="px-4 py-2 text-ink">{line.quantity}</td>
                <td className="px-4 py-2 text-ink-soft">{line.garmentCost != null ? money(line.garmentCost) : "—"}</td>
                <td className="px-4 py-2 text-ink-soft">{line.markingCost != null ? money(line.markingCost) : "—"}</td>
                <td className="px-4 py-2 text-ink">{money(line.unitPrice)}</td>
                <td className="px-4 py-2 font-semibold text-ink">{money(line.unitPrice * line.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        {order.discountCode && (
          <p className="text-ink-soft">
            Código {order.discountCode}: -{money(order.discountAmount)}
          </p>
        )}
        <p className="text-ink-soft">Envío: {order.shippingCost === 0 ? "Gratis" : money(order.shippingCost)}</p>
        <p className="font-display text-lg font-bold text-ink">Total: {money(order.total)}</p>
      </div>

      <form action={`/admin/pedidos/${order.id}/factusol`} method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="cursor-pointer font-display text-sm font-bold text-brand hover:text-brand-dark"
        >
          Descargar ZIP para FactuSol →
        </button>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" name="forceCli" value="1" className="cursor-pointer" />
          Incluir CLI.xlsx aunque el cliente ya tenga código
        </label>
      </form>
    </div>
  );
}
