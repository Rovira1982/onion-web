import Link from "next/link";
import { prisma } from "@/lib/db";

// Same fixed order as src/lib/products.ts OCCASION_ORDER — kept in sync by
// hand since that file has a "server-only" guard incompatible with scripts,
// same reasoning as prisma/seed-occasions.ts.
const OCCASION_ORDER = [
  "despedidas",
  "penyas-fiestas",
  "empresas-equipos",
  "regalos-personalizados",
  "navidad",
  "equipacion-deportiva",
  "comuniones",
  "bodas",
];

export default async function AdminOcasionesPage() {
  const occasions = await prisma.occasion.findMany({
    include: { _count: { select: { products: true } } },
  });
  const bySlug = new Map(occasions.map((o) => [o.slug, o]));
  const ordered = OCCASION_ORDER.map((slug) => bySlug.get(slug)).filter((o) => o !== undefined);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink">Ocasiones</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Productos destacados por ocasión en la home. Orden y prioridad fijados en{" "}
        <code className="text-xs">docs/todo-hero-y-catalogo-2026-09-29.md</code> — no alfabético.
      </p>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {ordered.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/ocasiones/${o.slug}`}
              className="flex items-center justify-between px-2 py-4 hover:bg-muted"
            >
              <span className="font-display font-bold text-ink">{o.name}</span>
              <span className="text-sm text-ink-soft">
                {o._count.products} {o._count.products === 1 ? "producto" : "productos"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
