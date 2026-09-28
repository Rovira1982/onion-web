import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getCategories, searchProducts } from "@/lib/products";

export const metadata = {
  title: "Catálogo",
};

type SearchParams = { categoria?: string; q?: string; page?: string };

function buildPageHref(base: { categoria?: string; q?: string }, page: number) {
  const params = new URLSearchParams();
  if (base.categoria) params.set("categoria", base.categoria);
  if (base.q) params.set("q", base.q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { categoria, q, page } = await searchParams;
  const categories = await getCategories();
  const { products, total, page: currentPage, totalPages } = await searchProducts({
    category: categoria,
    q,
    page: page ? parseInt(page, 10) : 1,
  });

  const activeCategory = categories.find((c) => c.slug === categoria);

  const categoryList = (
    <ul className="mt-4 max-h-[32rem] space-y-1 overflow-y-auto pr-2">
      <li>
        <Link
          href="/catalogo"
          className={`block rounded-lg px-3 py-2 text-sm font-medium ${
            !categoria ? "bg-brand-light text-brand" : "text-ink-soft hover:bg-muted"
          }`}
        >
          Todas
        </Link>
      </li>
      {categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/catalogo?categoria=${c.slug}`}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              categoria === c.slug ? "bg-brand-light text-brand" : "text-ink-soft hover:bg-muted"
            }`}
          >
            <span className="line-clamp-1">{c.name}</span>
            <span className="shrink-0 text-xs text-ink-soft">{c.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="text-xs text-ink-soft" aria-label="Migas de pan">
        <Link href="/" className="hover:text-brand">
          Inicio
        </Link>{" "}
        / <span className="text-ink">Catálogo</span>
      </nav>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">
            {activeCategory ? activeCategory.name : "Catálogo completo"}
          </h1>
          <p className="mt-1 text-ink-soft">
            {total} {total === 1 ? "producto encontrado" : "productos encontrados"}
          </p>
        </div>

        <form action="/catalogo" className="flex w-full max-w-sm gap-2 sm:w-auto">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <label htmlFor="q" className="sr-only">
            Buscar productos
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Buscar productos…"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            className="cursor-pointer shrink-0 rounded-xl bg-brand px-4 py-2.5 font-display text-sm font-bold text-white hover:bg-brand-dark"
          >
            Buscar
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Mobile: collapsible, closed once a category is picked so it doesn't push products down */}
        <details className="lg:hidden" open={!categoria}>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-border px-4 py-3 font-display text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
            <span>{activeCategory ? activeCategory.name : "Todas las categorías"}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="#1A1310" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          {categoryList}
        </details>

        {/* Desktop: always visible */}
        <aside className="hidden lg:block">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">
            Categorías
          </h2>
          {categoryList}
        </aside>

        <div>
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-ink-soft">
              No encontramos productos con esos filtros. Prueba con otra búsqueda.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-2"
                  aria-label="Paginación"
                >
                  <Link
                    href={buildPageHref({ categoria, q }, Math.max(1, currentPage - 1))}
                    aria-disabled={currentPage === 1}
                    className={`rounded-lg border border-border px-3 py-2 text-sm font-semibold ${
                      currentPage === 1
                        ? "pointer-events-none text-ink-soft/40"
                        : "text-ink hover:border-brand hover:text-brand"
                    }`}
                  >
                    Anterior
                  </Link>
                  <span className="px-3 text-sm text-ink-soft">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Link
                    href={buildPageHref({ categoria, q }, Math.min(totalPages, currentPage + 1))}
                    aria-disabled={currentPage === totalPages}
                    className={`rounded-lg border border-border px-3 py-2 text-sm font-semibold ${
                      currentPage === totalPages
                        ? "pointer-events-none text-ink-soft/40"
                        : "text-ink hover:border-brand hover:text-brand"
                    }`}
                  >
                    Siguiente
                  </Link>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
