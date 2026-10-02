import Link from "next/link";
import Image from "next/image";
import { getVisiblePacks } from "@/lib/packs";
import { getProductBySlug } from "@/lib/products";

export const metadata = {
  title: "Packs de camisetas personalizadas",
  description: "Packs cerrados de camisetas con tu logo, precio fijo con IVA incluido. Sin sorpresas, listo para pedir.",
  // Lanzamiento escalonado (dueño, 2026-09-30) — esta página no debe salir
  // en buscadores hasta que él decida publicar los packs.
  robots: { index: false, follow: false },
};

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default async function PacksPage() {
  const packs = await Promise.all(
    getVisiblePacks().map(async (pack) => ({ pack, product: await getProductBySlug(pack.productSlug) }))
  );
  const available = packs.filter((p) => p.product);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="inline-flex items-center rounded-full bg-brand-light px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-brand">
          Precio cerrado, sin sorpresas
        </span>
        <h1 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">Packs con tu logo</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">IVA y diseño incluidos.</p>
      </div>

      {available.length === 0 ? (
        <p className="mt-16 text-center text-ink-soft">Vuelve pronto — estamos preparando nuevos packs.</p>
      ) : (
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {available.map(({ pack, product }) => (
            <div key={pack.code} className="flex flex-col rounded-3xl border border-border bg-white p-8 shadow-sm">
              {product!.image && (
                <div className="mb-6 overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={product!.image}
                    alt={product!.name}
                    width={500}
                    height={500}
                    unoptimized
                    className="h-56 w-full object-cover"
                  />
                </div>
              )}
              <h2 className="font-display text-lg font-bold text-ink">{product!.name}</h2>
              <p className="mt-2 text-sm text-ink-soft">Logo delante y logo detrás incluidos, técnica DTF.</p>

              <div className="mt-6">
                <p className="font-display text-4xl font-extrabold text-brand">{money(pack.totalPrice)}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  IVA incluido · sale a {money(pack.totalPrice / pack.quantity)}/ud
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-soft">
                {[
                  `${pack.quantity} unidades fijas`,
                  "Diseño de tu logo incluido",
                  "Te damos el plazo exacto al aprobar el diseño",
                  "Mismo color, tallas surtidas",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href={`/producto/${pack.productSlug}?pack=${pack.code}#pack-form`}
                className="mt-8 block cursor-pointer rounded-full bg-brand px-6 py-3 text-center font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Quiero este pack
              </Link>
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs font-semibold text-ink">
        Precio con IVA y diseño del logo incluidos.
      </p>

      <p className="mt-3 text-center text-xs text-ink-soft">
        ¿Necesitas otra cantidad, técnica o prenda?{" "}
        <Link href="/presupuesto" className="font-semibold text-brand hover:text-brand-dark">
          Calcula tu presupuesto a medida
        </Link>
        .
      </p>
    </div>
  );
}
