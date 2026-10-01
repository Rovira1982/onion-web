import Link from "next/link";
import { listSupplierOrders } from "@/lib/supplier-orders";
import { requireAdmin } from "@/lib/auth";

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

export default async function AdminTandasPage() {
  await requireAdmin();
  const orders = await listSupplierOrders();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink">Tandas de pedido a proveedor</h1>

      {orders.length === 0 ? (
        <p className="mt-8 text-ink-soft">Todavía no hay tandas generadas.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-soft">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Proveedor</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Líneas</th>
              <th className="py-2 pr-4">Subtotal</th>
              <th className="py-2 pr-4">Manipulación</th>
              <th className="py-2 pr-4">Envío</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-border">
                <td className="py-2 pr-4">{o.batchRunAt.toLocaleString("es-ES")}</td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/tandas/${o.id}`} className="cursor-pointer font-semibold text-brand hover:text-brand-dark">
                    {o.adapterKey}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {o.status === "borrador" ? (
                    <span className="font-semibold text-amber-700">{STATUS_LABEL[o.status]}</span>
                  ) : o.status === "error" ? (
                    <span className="font-semibold text-red-700">{STATUS_LABEL[o.status]}</span>
                  ) : o.status === "enviado" ? (
                    <span className="font-semibold text-green-700">{STATUS_LABEL[o.status]}</span>
                  ) : (
                    STATUS_LABEL[o.status] ?? o.status
                  )}
                </td>
                <td className="py-2 pr-4">{o.lineCount}</td>
                <td className="py-2 pr-4">{money(o.subtotal)}</td>
                <td className="py-2 pr-4">{money(o.handlingFee)}</td>
                <td className="py-2 pr-4">{money(o.shippingCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
