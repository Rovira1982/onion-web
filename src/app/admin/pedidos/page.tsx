import { listOrders } from "@/lib/orders";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Listado mínimo para la exportación a FactuSol — no es el panel de
// administración final, pero ya vive detrás de /admin/login (ver proxy.ts).
export default async function AdminPedidosPage() {
  const orders = await listOrders();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink">Pedidos</h1>

      {orders.length === 0 ? (
        <p className="mt-8 text-ink-soft">Todavía no hay pedidos.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-soft">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Cliente</th>
              <th className="py-2 pr-4">Estado</th>
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
                <td className="py-2 pr-4">{o.invoiceName}</td>
                <td className="py-2 pr-4">{o.status}</td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
