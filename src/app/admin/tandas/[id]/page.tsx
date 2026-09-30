import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplierOrderById } from "@/lib/supplier-orders";
import BultosSelector from "./BultosSelector";
import { ConfirmarTandaButton, CancelarTandaButton, MarcarManualEnviadoButton } from "./TandaActions";
import CopyManualList from "./CopyManualList";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  confirmado: "Confirmado",
  enviado: "Enviado",
  error: "Error",
  cancelado: "Cancelado",
};

export default async function AdminTandaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getSupplierOrderById(id);
  if (!order) notFound();

  const isManual = order.adapterKey === "valento" || order.adapterKey === "cifra";
  const manualListText = order.lines.map((l) => `${l.supplierModelCode};${l.orderedQuantity}`).join("\n");
  const total = order.subtotal + order.handlingFee + order.shippingCost;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin/tandas" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Volver a tandas
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tanda {order.adapterKey} — {order.batchRunAt.toLocaleString("es-ES")}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Estado: <span className="font-semibold">{STATUS_LABEL[order.status] ?? order.status}</span>
            {order.supplierOrderCode && <> · Código proveedor: {order.supplierOrderCode}</>}
          </p>
        </div>
      </div>

      {order.notes && (
        <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {order.notes}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-ink-soft">
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Solicitado</th>
              <th className="px-4 py-2">Pedido</th>
              <th className="px-4 py-2">Tramo</th>
              <th className="px-4 py-2">Coste/ud</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Pedidos web</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-border">
                <td className="px-4 py-2 text-ink">
                  {line.productName}
                  <span className="block text-xs text-ink-soft">{[line.size, line.color].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-4 py-2 text-ink-soft">{line.supplierModelCode}</td>
                <td className="px-4 py-2 text-ink">{line.requestedQuantity}</td>
                <td className="px-4 py-2 text-ink">
                  {line.orderedQuantity}
                  {line.boxRounded && (
                    <span className="block text-xs font-semibold text-amber-700">
                      redondeado a caja (+{line.surplusQuantity} de sobrante → stock)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-ink-soft">
                  {line.priceTier}
                  {line.handlingFeeApplied && <span className="ml-1 text-xs text-amber-700">+manipulación</span>}
                </td>
                <td className="px-4 py-2 text-ink">{money(line.unitCost)}</td>
                <td className="px-4 py-2 font-semibold text-ink">{money(line.lineCost)}</td>
                <td className="px-4 py-2 text-xs text-ink-soft">{line.sourceOrderIds.map((oid) => oid.slice(0, 8)).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        <p className="text-ink-soft">Subtotal: {money(order.subtotal)}</p>
        <p className="text-ink-soft">Manipulación: {money(order.handlingFee)}</p>
        <p className="text-ink-soft">
          Envío: {order.quoteFromAccountManager ? "a cotizar por el comercial" : money(order.shippingCost)}
        </p>
        <p className="font-display text-lg font-bold text-ink">Total estimado: {money(total)}</p>
      </div>

      {order.status === "borrador" && !isManual && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-4">
          <BultosSelector supplierOrderId={order.id} parcelCount={order.parcelCount} />
          <div className="flex gap-3">
            <CancelarTandaButton supplierOrderId={order.id} />
            <ConfirmarTandaButton supplierOrderId={order.id} />
          </div>
        </div>
      )}

      {order.status === "borrador" && isManual && (
        <div className="mt-6 space-y-4">
          <CopyManualList text={manualListText} />
          <div className="flex justify-end gap-3">
            <CancelarTandaButton supplierOrderId={order.id} />
            <ConfirmarTandaButton supplierOrderId={order.id} />
          </div>
        </div>
      )}

      {order.status === "confirmado" && isManual && (
        <div className="mt-6 space-y-4">
          <CopyManualList text={manualListText} />
          <div className="flex justify-end">
            <MarcarManualEnviadoButton supplierOrderId={order.id} />
          </div>
        </div>
      )}
    </div>
  );
}
