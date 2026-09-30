import Link from "next/link";
import { calculateQuote, GARMENT_REFERENCE_COST, type QuoteInput } from "@/lib/pricing";

export const metadata = {
  title: "Packs de camisetas personalizadas",
  description: "Packs cerrados de camisetas con tu logo, precio fijo IVA y envío incluidos. Sin sorpresas, listo para pedir.",
};

// Landing para los anuncios de Meta/Facebook (propuesta de Director de
// operaciones, 2026-09-30, confirmada por el dueño): la competencia que
// mejor convierte en este nicho anuncia un pack a precio cerrado, no un
// catálogo — así que el anuncio debe aterrizar aquí, no en la calculadora
// genérica de /presupuesto.
//
// Los packs usan calculateQuote() en vivo, no precios fijos a mano: si
// cambia el coste de la prenda base o de la técnica, el precio del pack
// se recalcula solo la próxima vez que se construya la página.
type Pack = {
  slug: string;
  title: string;
  description: string;
  bullets: string[];
  input: QuoteInput;
};

const PACKS: Pack[] = [
  {
    slug: "pack-10-basico",
    title: "Pack 10 camisetas — logo pecho y espalda",
    description: "Logo pequeño (10×10 cm) en pecho y espalda, técnica DTF.",
    bullets: ["Mínimo 10 unidades", "Diseño de tu logo incluido", "Entrega en 7 días", "Todas las tallas y colores del modelo"],
    input: {
      technique: "DTF",
      pecho: { active: true, colors: 1, size: "10x10" },
      espalda: { active: true, colors: 1, size: "10x10" },
      mangas: { active: false, colors: 1, size: "10x10" },
      garmentType: "Basica",
      garmentUnitCost: GARMENT_REFERENCE_COST.Basica,
      quantity: 10,
      extraMargin: 0.7,
      personalizedName: false,
    },
  },
  {
    slug: "pack-10-grande",
    title: "Pack 10 camisetas — logo grande",
    description: "Logo grande en pecho (23×23 cm) y espalda (30×30 cm), técnica DTF.",
    bullets: ["Mínimo 10 unidades", "Diseño de tu logo incluido", "Entrega en 7 días", "Todas las tallas y colores del modelo"],
    input: {
      technique: "DTF",
      pecho: { active: true, colors: 1, size: "23x23" },
      espalda: { active: true, colors: 1, size: "30x30" },
      mangas: { active: false, colors: 1, size: "10x10" },
      garmentType: "Basica",
      garmentUnitCost: GARMENT_REFERENCE_COST.Basica,
      quantity: 10,
      extraMargin: 0.7,
      personalizedName: false,
    },
  },
];

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function PacksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="inline-flex items-center rounded-full bg-brand-light px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-brand">
          Precio cerrado, sin sorpresas
        </span>
        <h1 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">Packs de camisetas con tu logo</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          IVA y envío incluidos. Nos encargamos del diseño y te lo entregamos en 7 días.
        </p>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        {PACKS.map((pack) => {
          const result = calculateQuote(pack.input);
          const total = result.order.total;
          const perUnit = total / pack.input.quantity;

          return (
            <div key={pack.slug} className="flex flex-col rounded-3xl border border-border bg-white p-8 shadow-sm">
              <h2 className="font-display text-lg font-bold text-ink">{pack.title}</h2>
              <p className="mt-2 text-sm text-ink-soft">{pack.description}</p>

              <div className="mt-6">
                <p className="font-display text-4xl font-extrabold text-brand">{money(total)}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  IVA y envío incluidos · sale a {money(perUnit)}/ud
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-soft">
                {pack.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href={`/contacto?producto=${encodeURIComponent(pack.title)}`}
                className="mt-8 block cursor-pointer rounded-full bg-brand px-6 py-3 text-center font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Quiero este pack
              </Link>
            </div>
          );
        })}
      </div>

      {/* El pie de página general dice "Precios sin IVA" (cierto para el
          resto del catálogo) — esta nota es la que aplica aquí y va antes
          para que no choque visualmente con el pie (detectado por el
          Diseñador gráfico al revisar la landing, 2026-09-30). */}
      <p className="mt-10 text-center text-xs font-semibold text-ink">
        Precio con IVA incluido. Envío y diseño del logo incluidos en estos packs. Mínimo 10 unidades.
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
