"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateQuote,
  BASE_COSTS,
  GARMENT_REFERENCE_COST,
  type Technique,
  type PrintSize,
  type GarmentType,
  type PrintZone,
} from "@/lib/pricing";

const TECHNIQUES: { value: Technique; label: string }[] = [
  { value: "DTF", label: "DTF (transferencia digital)" },
  { value: "Serigrafia", label: "Serigrafía" },
  { value: "Vinilo", label: "Vinilo (corte y termotransferencia)" },
  { value: "Sublimacion", label: "Sublimación" },
];

const SIZES: { value: PrintSize; label: string }[] = [
  { value: "10x10", label: "Pequeño (10×10 cm)" },
  { value: "23x23", label: "Mediano (23×23 cm)" },
  { value: "30x30", label: "Grande (30×30 cm)" },
];

const GARMENT_TYPES: { value: GarmentType; label: string }[] = [
  { value: "Basica", label: "Básica" },
  { value: "Gama_media", label: "Gama media" },
  { value: "Premium", label: "Premium" },
  { value: "Cliente", label: "La trae el cliente" },
];

const DEFAULT_ZONE: PrintZone = { active: false, colors: 1, size: "10x10" };

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function ZoneEditor({
  title,
  zone,
  onChange,
  showMultiplier,
  multiplier,
  onMultiplierChange,
}: {
  title: string;
  zone: PrintZone;
  onChange: (z: PrintZone) => void;
  showMultiplier?: boolean;
  multiplier?: number;
  onMultiplierChange?: (n: number) => void;
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${zone.active ? "border-brand bg-brand-light" : "border-border bg-white"}`}>
      <label className="flex items-center justify-between gap-3">
        <span className="font-display text-sm font-bold text-ink">{title}</span>
        <input
          type="checkbox"
          checked={zone.active}
          onChange={(e) => onChange({ ...zone, active: e.target.checked })}
          className="h-5 w-5 accent-brand"
        />
      </label>
      {zone.active && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">Colores</span>
            <select
              value={zone.colors}
              onChange={(e) => onChange({ ...zone, colors: Number(e.target.value) })}
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
            <span className="text-xs font-semibold text-ink-soft">Tamaño</span>
            <select
              value={zone.size}
              onChange={(e) => onChange({ ...zone, size: e.target.value as PrintSize })}
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {showMultiplier && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-semibold text-ink-soft">
                Nº de mangas a estampar (1 = una manga, 2 = las dos)
              </span>
              <input
                type="number"
                min={1}
                max={2}
                value={multiplier}
                onChange={(e) => onMultiplierChange?.(Number(e.target.value))}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export default function PresupuestoPage() {
  const [technique, setTechnique] = useState<Technique>("DTF");
  const [pecho, setPecho] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [espalda, setEspalda] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [mangas, setMangas] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [mangasMultiplier, setMangasMultiplier] = useState(1);
  const [garmentType, setGarmentType] = useState<GarmentType>("Basica");
  const [garmentUnitCost, setGarmentUnitCost] = useState(GARMENT_REFERENCE_COST.Basica);
  const [quantity, setQuantity] = useState(24);
  const [extraMarginPct, setExtraMarginPct] = useState(70);
  const [personalizedName, setPersonalizedName] = useState(false);

  const noZoneActive = !pecho.active && !espalda.active && !mangas.active;

  const result = useMemo(() => {
    if (noZoneActive || quantity <= 0) return null;
    return calculateQuote({
      technique,
      pecho,
      espalda,
      mangas: { ...mangas, multiplier: mangasMultiplier },
      garmentType,
      garmentUnitCost,
      quantity,
      extraMargin: extraMarginPct / 100,
      personalizedName,
    });
  }, [technique, pecho, espalda, mangas, mangasMultiplier, garmentType, garmentUnitCost, quantity, extraMarginPct, personalizedName, noZoneActive]);

  function handleGarmentTypeChange(type: GarmentType) {
    setGarmentType(type);
    setGarmentUnitCost(GARMENT_REFERENCE_COST[type]);
  }

  const summaryForQuote = () => {
    const zones = [
      pecho.active && `Pecho (${pecho.colors} color/es, ${pecho.size})`,
      espalda.active && `Espalda (${espalda.colors} color/es, ${espalda.size})`,
      mangas.active && `Mangas ×${mangasMultiplier} (${mangas.colors} color/es, ${mangas.size})`,
    ]
      .filter(Boolean)
      .join(", ");
    const priceLine = result
      ? `Precio orientativo: ${money(result.finalUnitPrices.recommended)}/ud · Total ${money(result.order.total)} (IVA incl.)`
      : "";
    return `Presupuesto configurado en la web:\n- Técnica: ${technique}\n- Zonas: ${zones || "ninguna seleccionada"}\n- Prenda: ${garmentType}, cantidad ${quantity}\n- ${priceLine}\n\n`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/presupuesto" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Cambiar tipo de presupuesto
      </Link>
      <span className="mt-4 block font-display text-xs font-bold uppercase tracking-wide text-brand">
        Calculadora
      </span>
      <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">Calcula tu presupuesto</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Configura la técnica, las zonas de estampado y la cantidad. El precio se calcula al
        instante con nuestra estructura de costes real — es orientativo, y lo confirmamos
        contigo antes de fabricar nada.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Formulario */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-white p-5">
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-bold text-ink">Técnica de estampado</span>
              <select
                value={technique}
                onChange={(e) => setTechnique(e.target.value as Technique)}
                className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink"
              >
                {TECHNIQUES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ZoneEditor title="Pecho" zone={pecho} onChange={setPecho} />
            <ZoneEditor title="Espalda" zone={espalda} onChange={setEspalda} />
            <ZoneEditor
              title="Mangas"
              zone={mangas}
              onChange={setMangas}
              showMultiplier
              multiplier={mangasMultiplier}
              onMultiplierChange={setMangasMultiplier}
            />
          </div>
          {noZoneActive && (
            <p className="-mt-2 text-sm text-brand-dark">
              Activa al menos una zona (pecho, espalda o mangas) para ver el precio.
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

            <label className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={personalizedName}
                onChange={(e) => setPersonalizedName(e.target.checked)}
                className="h-5 w-5 accent-brand"
              />
              <span className="text-sm text-ink">
                Nombre personalizado por unidad (+{money(BASE_COSTS.Cargo_nombre)}/ud)
              </span>
            </label>
          </div>
        </div>

        {/* Resultado */}
        <aside className="h-fit rounded-3xl bg-ink p-6 text-white lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Presupuesto orientativo</h2>

          {!result ? (
            <p className="mt-4 text-sm text-white/60">
              Completa la configuración para ver el precio.
            </p>
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
