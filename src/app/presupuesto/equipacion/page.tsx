"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateTeamGarmentQuote,
  BASE_COSTS,
  GARMENT_REFERENCE_COST,
  CARGO_NOMBRE_EQUIPACION,
  CARGO_DORSAL_EQUIPACION,
  type Technique,
  type PrintSize,
  type GarmentType,
  type DtfMark,
} from "@/lib/pricing";

// Mangas: solo Serigrafía o DTF. El vinilo, en este presupuestador, se
// reserva para nombre/dorsal (cargo fijo más abajo) — no es una opción de
// mangas ni de ningún otro marcaje aquí.
const TECHNIQUES: { value: Technique; label: string }[] = [
  { value: "DTF", label: "DTF (transferencia digital)" },
  { value: "Serigrafia", label: "Serigrafía" },
];

const SIZES: { value: PrintSize; label: string }[] = [
  { value: "10x10", label: "10×10 cm" },
  { value: "23x23", label: "23×23 cm" },
  { value: "30x30", label: "30×30 cm" },
];

const GARMENT_TYPES: { value: GarmentType; label: string }[] = [
  { value: "Basica", label: "Básica" },
  { value: "Gama_media", label: "Gama media" },
  { value: "Premium", label: "Premium" },
  { value: "Cliente", label: "La trae el cliente" },
];

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function MarkToggle({
  title,
  sizeLabel,
  priceLabel,
  active,
  onToggle,
}: {
  title: string;
  sizeLabel?: string;
  priceLabel?: string;
  active: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
        active ? "border-brand bg-brand-light" : "border-border bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-5 w-5 accent-brand"
      />
      <span className="flex-1 font-medium text-ink">{title}</span>
      {sizeLabel && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-soft">{sizeLabel}</span>}
      {priceLabel && <span className="text-xs font-semibold text-brand">{priceLabel}</span>}
    </label>
  );
}

export default function EquipacionPresupuestoPage() {
  const [bolsilloIzq, setBolsilloIzq] = useState(false);
  const [bolsilloDer, setBolsilloDer] = useState(false);
  const [diafragma, setDiafragma] = useState(false);
  const [nombre, setNombre] = useState(false);
  const [dorsal, setDorsal] = useState(false);
  const [logoEspalda, setLogoEspalda] = useState(false);
  const [logoEspaldaSize, setLogoEspaldaSize] = useState<PrintSize>("30x30");

  const [mangasActive, setMangasActive] = useState(false);
  const [mangasTechnique, setMangasTechnique] = useState<Technique>("DTF");
  const [mangasColors, setMangasColors] = useState(1);
  const [mangasSize, setMangasSize] = useState<PrintSize>("10x10");
  const [mangasMultiplier, setMangasMultiplier] = useState(1);

  const [garmentType, setGarmentType] = useState<GarmentType>("Basica");
  const [garmentUnitCost, setGarmentUnitCost] = useState(GARMENT_REFERENCE_COST.Basica);
  const [quantity, setQuantity] = useState(24);
  const [extraMarginPct, setExtraMarginPct] = useState(70);

  const noMarkActive = !bolsilloIzq && !bolsilloDer && !diafragma && !nombre && !dorsal && !logoEspalda && !mangasActive;

  const result = useMemo(() => {
    if (noMarkActive || quantity <= 0) return null;

    const pechoMarks: DtfMark[] = [
      { position: "bolsillo_izq", active: bolsilloIzq, size: "10x10" },
      { position: "bolsillo_der", active: bolsilloDer, size: "10x10" },
      { position: "diafragma", active: diafragma, size: "23x23" },
    ];

    return calculateTeamGarmentQuote({
      pechoMarks,
      espaldaLogo: { position: "logo_espalda", active: logoEspalda, size: logoEspaldaSize },
      nombre,
      dorsal,
      mangas: {
        active: mangasActive,
        colors: mangasColors,
        size: mangasSize,
        multiplier: mangasMultiplier,
        technique: mangasTechnique,
      },
      garmentType,
      garmentUnitCost,
      quantity,
      extraMargin: extraMarginPct / 100,
    });
  }, [
    noMarkActive,
    quantity,
    bolsilloIzq,
    bolsilloDer,
    diafragma,
    logoEspalda,
    logoEspaldaSize,
    nombre,
    dorsal,
    mangasActive,
    mangasColors,
    mangasSize,
    mangasMultiplier,
    mangasTechnique,
    garmentType,
    garmentUnitCost,
    extraMarginPct,
  ]);

  function handleGarmentTypeChange(type: GarmentType) {
    setGarmentType(type);
    setGarmentUnitCost(GARMENT_REFERENCE_COST[type]);
  }

  const summaryForQuote = () => {
    const marks = [
      bolsilloIzq && "Bolsillo izquierdo (10×10, DTF)",
      bolsilloDer && "Bolsillo derecho (10×10, DTF)",
      diafragma && "Diafragma (23×23, DTF)",
      logoEspalda && `Logo espalda (${logoEspaldaSize}, DTF)`,
      nombre && "Nombre individual (vinilo)",
      dorsal && "Dorsal (vinilo)",
      mangasActive && `Mangas ×${mangasMultiplier} (${mangasTechnique}, ${mangasSize})`,
    ]
      .filter(Boolean)
      .join(", ");
    const priceLine = result
      ? `Precio orientativo: ${money(result.finalUnitPrices.recommended)}/ud · Total ${money(result.order.total)} (IVA incl.)`
      : "";
    return `Presupuesto de equipación configurado en la web:\n- Marcas: ${marks || "ninguna seleccionada"}\n- Prenda: ${garmentType}, cantidad ${quantity}\n- ${priceLine}\n\n`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/presupuesto" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Cambiar tipo de presupuesto
      </Link>
      <span className="mt-4 block font-display text-xs font-bold uppercase tracking-wide text-brand">
        Calculadora de equipaciones
      </span>
      <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">Camisetas, polos y uniformes</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Cada marca del pecho y la espalda se cobra por separado. El nombre y el dorsal van en
        vinilo (en casa); los logos van en DTF. Es orientativo, y lo confirmamos contigo antes de
        fabricar nada.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-white p-5">
            <h2 className="font-display text-sm font-bold text-ink">
              Pecho <span className="font-normal text-ink-soft">— hasta 3 marcas, DTF</span>
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              <MarkToggle title="Bolsillo izquierdo" sizeLabel="10×10" active={bolsilloIzq} onToggle={setBolsilloIzq} />
              <MarkToggle title="Bolsillo derecho" sizeLabel="10×10" active={bolsilloDer} onToggle={setBolsilloDer} />
              <MarkToggle title="Diafragma" sizeLabel="23×23" active={diafragma} onToggle={setDiafragma} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <h2 className="font-display text-sm font-bold text-ink">
              Espalda <span className="font-normal text-ink-soft">— nombre y dorsal en vinilo, logo en DTF</span>
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              <MarkToggle
                title="Nombre individual"
                priceLabel={`+${money(CARGO_NOMBRE_EQUIPACION)}/ud`}
                active={nombre}
                onToggle={setNombre}
              />
              <MarkToggle
                title="Dorsal"
                priceLabel={`+${money(CARGO_DORSAL_EQUIPACION)}/ud`}
                active={dorsal}
                onToggle={setDorsal}
              />
              <MarkToggle title="Logo abajo" sizeLabel={logoEspaldaSize} active={logoEspalda} onToggle={setLogoEspalda} />
              {logoEspalda && (
                <label className="ml-8 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft">Tamaño del logo</span>
                  <select
                    value={logoEspaldaSize}
                    onChange={(e) => setLogoEspaldaSize(e.target.value as PrintSize)}
                    className="w-40 rounded-lg border border-border px-3 py-2 text-sm text-ink"
                  >
                    {SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-5 transition-colors ${
              mangasActive ? "border-brand bg-brand-light" : "border-border bg-white"
            }`}
          >
            <label className="flex items-center justify-between gap-3">
              <span className="font-display text-sm font-bold text-ink">
                Mangas <span className="font-normal text-ink-soft">— serigrafía o DTF</span>
              </span>
              <input
                type="checkbox"
                checked={mangasActive}
                onChange={(e) => setMangasActive(e.target.checked)}
                className="h-5 w-5 accent-brand"
              />
            </label>
            {mangasActive && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft">Técnica</span>
                  <select
                    value={mangasTechnique}
                    onChange={(e) => setMangasTechnique(e.target.value as Technique)}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
                  >
                    {TECHNIQUES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft">Tamaño</span>
                  <select
                    value={mangasSize}
                    onChange={(e) => setMangasSize(e.target.value as PrintSize)}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
                  >
                    {SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft">Colores</span>
                  <select
                    value={mangasColors}
                    onChange={(e) => setMangasColors(Number(e.target.value))}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
                  >
                    {[1, 2, 3].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft">Nº de mangas (1 o 2)</span>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={mangasMultiplier}
                    onChange={(e) => setMangasMultiplier(Number(e.target.value))}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>
            )}
          </div>

          {noMarkActive && (
            <p className="-mt-2 text-sm text-brand-dark">
              Activa al menos una marca (pecho, espalda o mangas) para ver el precio.
            </p>
          )}

          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="font-display text-sm font-bold text-ink">Tipo de prenda</span>
                <select
                  value={garmentType}
                  onChange={(e) => handleGarmentTypeChange(e.target.value as GarmentType)}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink"
                >
                  {GARMENT_TYPES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-display text-sm font-bold text-ink">Coste por prenda (€)</span>
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={garmentUnitCost}
                  onChange={(e) => setGarmentUnitCost(Number(e.target.value))}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-display text-sm font-bold text-ink">Cantidad</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-display text-sm font-bold text-ink">Margen extra (%)</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={extraMarginPct}
                  onChange={(e) => setExtraMarginPct(Number(e.target.value))}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink"
                />
              </label>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-3xl bg-ink p-6 text-white lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Presupuesto orientativo</h2>

          {!result ? (
            <p className="mt-4 text-sm text-white/60">Completa la configuración para ver el precio.</p>
          ) : (
            <>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">Precio por unidad</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-brand">
                    {money(result.finalUnitPrices.recommended)}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Rango: {money(result.finalUnitPrices.min)} – {money(result.finalUnitPrices.premium)}
                  </p>
                </div>

                {result.nombreDorsalSurcharge > 0 && (
                  <p className="text-xs text-white/60">
                    Incluye +{money(result.nombreDorsalSurcharge)}/ud de nombre/dorsal.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/50">Subtotal ({quantity} uds.)</p>
                    <p className="font-display font-bold">{money(result.order.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">IVA (21%)</p>
                    <p className="font-display font-bold">{money(result.order.vat)}</p>
                  </div>
                  <div className="col-span-2 border-t border-white/15 pt-3">
                    <p className="text-white/50">Total con IVA</p>
                    <p className="font-display text-xl font-extrabold">{money(result.order.total)}</p>
                  </div>
                </div>
              </div>

              <Link
                href={`/contacto?resumen=${encodeURIComponent(summaryForQuote())}`}
                className="mt-6 block cursor-pointer rounded-full bg-brand px-5 py-3 text-center font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Solicitar este presupuesto
              </Link>
              <p className="mt-3 text-center text-xs text-white/40">
                Precio orientativo, no vinculante. Lo confirmamos antes de producir.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
