import Link from "next/link";
import { listDiscountCodes } from "@/lib/discounts";

function fmt(d: Date) {
  return d.toLocaleDateString("es-ES");
}

// Listado mínimo de códigos de descuento — sin autenticación todavía; no
// desplegar a producción hasta que esta sección esté protegida.
export default async function AdminCodigosPage() {
  const codes = await listDiscountCodes();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Códigos de descuento</h1>
        <Link
          href="/admin/codigos/nuevo"
          className="cursor-pointer rounded-full bg-brand px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
        >
          Nuevo código
        </Link>
      </div>
      <p className="mt-2 text-sm text-red-600">
        Vista provisional sin autenticación — solo para pruebas locales. No publicar así.
      </p>

      {codes.length === 0 ? (
        <p className="mt-8 text-ink-soft">Todavía no hay códigos.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-soft">
              <th className="py-2 pr-4">Código</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">%</th>
              <th className="py-2 pr-4">Usos</th>
              <th className="py-2 pr-4">Cliente</th>
              <th className="py-2 pr-4">Caduca</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => {
              const expired = c.expiresAt ? c.expiresAt < new Date() : false;
              const exhausted = c.maxUses !== null && c.usesCount >= c.maxUses;
              return (
                <tr key={c.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-semibold text-ink">{c.code}</td>
                  <td className="py-2 pr-4">
                    {c.type === "un_solo_uso" ? "Un solo uso" : "Cliente habitual"}
                  </td>
                  <td className="py-2 pr-4">{c.percentage}%</td>
                  <td className="py-2 pr-4">
                    {c.usesCount} / {c.maxUses ?? "∞"}
                  </td>
                  <td className="py-2 pr-4">{c.customerEmail ?? "—"}</td>
                  <td className="py-2 pr-4">{c.expiresAt ? fmt(c.expiresAt) : "—"}</td>
                  <td className="py-2 pr-4">
                    {!c.active ? (
                      <span className="text-xs text-ink-soft">Desactivado</span>
                    ) : expired ? (
                      <span className="text-xs text-red-600">Caducado</span>
                    ) : exhausted ? (
                      <span className="text-xs text-red-600">Agotado</span>
                    ) : (
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-bold text-brand">
                        Activo
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/codigos/${c.id}`}
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
