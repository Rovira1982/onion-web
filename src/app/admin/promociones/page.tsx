import Link from "next/link";
import { listPromotions } from "@/lib/promotions";
import { requireAdmin } from "@/lib/auth";

function fmt(d: Date) {
  return d.toLocaleDateString("es-ES");
}

export default async function AdminPromocionesPage() {
  await requireAdmin();
  const promotions = await listPromotions();
  const now = new Date();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Promociones</h1>
        <Link
          href="/admin/promociones/nueva"
          className="cursor-pointer rounded-full bg-brand px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
        >
          Nueva promoción
        </Link>
      </div>
      {promotions.length === 0 ? (
        <p className="mt-8 text-ink-soft">Todavía no hay promociones.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-soft">
              <th className="py-2 pr-4">Título</th>
              <th className="py-2 pr-4">Del</th>
              <th className="py-2 pr-4">Al</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => {
              const isLive = p.active && p.startDate <= now && p.endDate >= now;
              return (
                <tr key={p.id} className="border-b border-border">
                  <td className="py-2 pr-4">{p.title}</td>
                  <td className="py-2 pr-4">{fmt(p.startDate)}</td>
                  <td className="py-2 pr-4">{fmt(p.endDate)}</td>
                  <td className="py-2 pr-4">
                    {isLive ? (
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-bold text-brand">
                        En directo
                      </span>
                    ) : p.active ? (
                      <span className="text-xs text-ink-soft">Fuera de fecha</span>
                    ) : (
                      <span className="text-xs text-ink-soft">Desactivada</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/promociones/${p.id}`}
                      className="cursor-pointer font-display text-xs font-bold text-brand hover:text-brand-dark"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
