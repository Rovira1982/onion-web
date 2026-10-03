import Link from "next/link";
import { listOrders } from "@/lib/orders";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, isOrderStatus } from "@/lib/order-status";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Listado mínimo para la exportación a FactuSol — no es el panel de
// administración final, pero ya vive detrás de /admin/login (ver proxy.ts).
export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; pago?: string }>;
}) {
  await requireAdmin();
  const { estado, pago } = await searchParams;
  const all = await listOrders();
  // El botón de exportar cuenta SIEMPRE los pedidos nuevos de todos, no solo los filtrados.
  const pendingCount = all.filter((o) => !o.factusolExported).length;
  const orders = all.filter(
    (o) =>
      (!estado || o.status === estado) &&
      (!pago || (pago === "pagado" ? o.paymentStatus === "pagado" : o.paymentStatus !== "pagado"))
  );
  const filtered = Boolean(estado || pago);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Pedidos</h1>
        <form action="/admin/pedidos/exportar" method="get" className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pendingCount === 0}
            className="cursor-pointer rounded-full bg-brand px-5 py-2.5 font-display text-sm font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar pedidos nuevos ({pendingCount})
          </button>
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" name="forceCli" value="1" className="cursor-pointer" />
            Incluir CLI.xlsx aunque el cliente ya tenga código
          </label>
        </form>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="rounded-lg border border-border px-2 py-1.5 text-ink">
            <option value="">Todos</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">Pago</span>
          <select name="pago" defaultValue={pago ?? ""} className="rounded-lg border border-border px-2 py-1.5 text-ink">
            <option value="">Todos</option>
            <option value="pagado">Pagado</option>
            <option value="pendiente">Sin pagar</option>
          </select>
        </label>
        <button type="submit" className="cursor-pointer rounded-full border border-brand px-4 py-1.5 font-display text-xs font-bold text-brand hover:bg-brand-light">
          Filtrar
        </button>
        {filtered && (
          <Link href="/admin/pedidos" className="text-xs font-semibold text-ink-soft hover:text-brand">
            Quitar filtros
          </Link>
        )}
        <span className="ml-auto text-xs text-ink-soft">
          {orders.length} de {all.length} pedidos
        </span>
      </form>

      {orders.length === 0 ? (
        <p className="mt-8 text-ink-soft">{filtered ? "Ningún pedido con esos filtros." : "Todavía no hay pedidos."}</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-soft">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Cliente</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Pago</th>
              <th className="py-2 pr-4">Líneas</th>
              <th className="py-2 pr-4">Código</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">FactuSol</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-border">
                <td className="py-2 pr-4">{o.createdAt.toLocaleDateString("es-ES")}</td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/pedidos/${o.id}`} className="cursor-pointer font-semibold text-brand hover:text-brand-dark">
                    {o.invoiceName}
                  </Link>
                </td>
                <td className="py-2 pr-4">{isOrderStatus(o.status) ? ORDER_STATUS_LABEL[o.status] : o.status}</td>
                <td className="py-2 pr-4">
                  {o.paymentStatus === "pagado" ? (
                    <span className="font-semibold text-green-700">Pagado</span>
                  ) : (
                    o.paymentStatus
                  )}
                </td>
                <td className="py-2 pr-4">{o.lineCount}</td>
                <td className="py-2 pr-4">{o.discountCode ?? "—"}</td>
                <td className="py-2 pr-4">{money(o.total)}</td>
                <td className="py-2 pr-4">
                  <a
                    href={`/admin/pedidos/${o.id}/factusol`}
                    className="cursor-pointer font-display text-xs font-bold text-brand hover:text-brand-dark"
                  >
                    Descargar ZIP
                  </a>
                  {o.factusolExported && <span className="ml-2 text-xs text-ink-soft">(exportado)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
