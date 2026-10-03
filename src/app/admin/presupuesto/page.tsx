import Link from "next/link";

const OPTIONS = [
  {
    href: "/admin/presupuesto/regalo",
    label: "Regalo",
    title: "Regalo o artículo promocional",
    description:
      "Bolígrafos, tazas, libretas, mochilas... Un único sistema de marcaje (serigrafía, vinilo, sublimación o DTF) en una o varias zonas.",
    cta: "Calcular regalo promocional",
  },
  {
    href: "/admin/presupuesto/equipacion",
    label: "Equipo",
    title: "Equipación de equipo o uniformes",
    description:
      "Camisetas, polos y sudaderas con varias marcas independientes: logos en el pecho, nombre y dorsal individual en la espalda.",
    cta: "Calcular equipación",
  },
];

export default function PresupuestoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <span className="font-display text-xs font-bold uppercase tracking-wide text-brand">
        Calculadora
      </span>
      <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">¿Qué quieres presupuestar?</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Elige el tipo de pedido para calcular el precio con nuestra estructura de costes real.
        Es orientativo, y lo confirmamos contigo antes de fabricar nada.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <Link
            key={opt.href}
            href={opt.href}
            className="group flex flex-col rounded-3xl border border-border bg-white p-6 transition-colors hover:border-brand"
          >
            <span className="inline-flex w-fit rounded-full bg-brand-light px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-brand">
              {opt.label}
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">{opt.title}</h2>
            <p className="mt-2 flex-1 text-sm text-ink-soft">{opt.description}</p>
            <span className="mt-5 inline-flex items-center gap-1 font-display text-sm font-bold text-brand group-hover:text-brand-dark">
              {opt.cta} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
