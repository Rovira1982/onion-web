"use client";

import { ASKS_MARKING_COLOR, MARKING_COLOR_PALETTE } from "@/lib/marking-colors";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { type PrintSize, type PrintZone, type Technique, type QuoteInput } from "@/lib/pricing";
import { personalizedUnitPrice, PERSONALIZED_EXTRA_MARGIN } from "@/lib/line-price";
import { selectGarmentTier, type GarmentTier } from "@/lib/garment-price";
import { subirLogo } from "@/app/producto/[slug]/actions";
import { type FormVariant } from "@/components/AddToCartForm";

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function sortVariantsBySize<T extends { size: string }>(variants: T[]): T[] {
  return variants.slice().sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.size);
    const ib = SIZE_ORDER.indexOf(b.size);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.size.localeCompare(b.size);
  });
}

const SIZES: { value: PrintSize; label: string }[] = [
  { value: "10x10", label: "10×10 cm" },
  { value: "22x22", label: "22×22 cm" },
  { value: "28x28", label: "28×28 cm" },
];

const TECHNIQUE_LABEL: Record<Technique, string> = {
  DTF: "DTF (transferencia digital)",
  Serigrafia: "Serigrafía",
  Vinilo: "Vinilo (corte y termotransferencia)",
  Sublimacion: "Sublimación",
};

// Igual que Vinilo en AddToCartForm — no tiene precio online, siempre pide
// presupuesto a medida.
const REQUIRES_CONSULTATION: Record<Technique, boolean> = {
  DTF: false,
  Sublimacion: false,
  Serigrafia: false,
  Vinilo: true,
};

function ColorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-2 flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-soft">Color del marcaje (opcional)</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
      >
        <option value="">El de mi logo / sin indicar</option>
        {MARKING_COLOR_PALETTE.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Versión sin posicionador visual de AddToCartForm — para productos que no
// son prendas de torso (bolsas, tazas, llaveros...) pero cuyo proveedor SÍ
// confirma una técnica que el presupuestador sabe calcular (ver
// parseOnlineTechniques en product-format.ts). No hay maniquí sobre el que
// posicionar el logo, así que solo hay una zona de marcaje genérica y el
// logo se sube como referencia de producción, sin mockup.
export default function SimpleMarkingAddToCartForm({
  productSlug,
  productName,
  image,
  variants,
  unitsPerPack,
  unitsPerCase,
  incompleteData,
  availableTechniques,
}: {
  productSlug: string;
  productName: string;
  image: string;
  variants: FormVariant[];
  unitsPerPack: number | null;
  unitsPerCase: number | null;
  incompleteData: boolean;
  availableTechniques: Technique[];
}) {
  const { addItems } = useCart();
  const router = useRouter();
  const sortedVariants = useMemo(() => sortVariantsBySize(variants), [variants]);

  const [mode, setMode] = useState<"stock" | "personalizado">("stock");
  const [technique, setTechnique] = useState<Technique>(availableTechniques[0]);
  const [colors, setColors] = useState(1);
  const [size, setSize] = useState<PrintSize>("10x10");
  const [frontColor, setFrontColor] = useState("");
  const [backColor, setBackColorName] = useState("");
  const [backActive, setBackActive] = useState(false);
  const [backColors, setBackColors] = useState(1);
  const [backSize, setBackSize] = useState<PrintSize>("10x10");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);

  const needsConsultation = REQUIRES_CONSULTATION[technique];
  const asksColor = ASKS_MARKING_COLOR[technique];
  const totalQuantity = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  const zone: PrintZone = { active: true, colors, size };
  const inactiveZone: PrintZone = { active: false, colors: 1, size: "10x10" };
  // Segunda cara opcional ("Detrás / otra cara") — el motor de precios y el
  // pedido ya tratan "espalda" como una zona más, con su propio tamaño y
  // colores, cobrada aparte (petición del dueño, 2026-10-03).
  const backZone: PrintZone = backActive ? { active: true, colors: backColors, size: backSize } : inactiveZone;
  const markingConfig: QuoteInput | null =
    mode === "personalizado"
      ? {
          technique,
          pecho: zone,
          espalda: backZone,
          mangas: inactiveZone,
          garmentType: "Cliente",
          garmentUnitCost: 0,
          quantity: totalQuantity,
          extraMargin: PERSONALIZED_EXTRA_MARGIN,
          personalizedName: false,
        }
      : null;

  const pricing = useMemo(() => {
    const map = new Map<string, { price: number | null; tier: GarmentTier; garmentPrice: number }>();
    for (const v of sortedVariants) {
      const qty = quantities[v.id] ?? 0;
      const garmentPricing = selectGarmentTier(
        { price: v.price, pricePack: v.pricePack, priceBox: v.priceBox, unitsPerPack, unitsPerCase, incompleteData },
        qty || 1
      );
      if (!markingConfig || needsConsultation || totalQuantity === 0) {
        map.set(v.id, { price: mode === "stock" ? garmentPricing.price : null, tier: garmentPricing.tier, garmentPrice: garmentPricing.price });
        continue;
      }
      const price = personalizedUnitPrice({ ...markingConfig, garmentUnitCost: garmentPricing.price }, garmentPricing.price);
      map.set(v.id, { price, tier: garmentPricing.tier, garmentPrice: garmentPricing.price });
    }
    return map;
  }, [sortedVariants, quantities, unitsPerPack, unitsPerCase, incompleteData, markingConfig, needsConsultation, totalQuantity, mode]);

  const activeVariants = sortedVariants.filter((v) => (quantities[v.id] ?? 0) > 0);
  const canAdd = activeVariants.length > 0 && activeVariants.every((v) => pricing.get(v.id)?.price !== null) && !needsConsultation;
  const subtotal = activeVariants.reduce((sum, v) => sum + (pricing.get(v.id)?.price ?? 0) * quantities[v.id]!, 0);

  function setQuantity(variantId: string, value: number) {
    const safe = Math.max(0, Math.floor(value) || 0);
    setQuantities((prev) => {
      if (safe === 0) {
        const next = { ...prev };
        delete next[variantId];
        return next;
      }
      return { ...prev, [variantId]: safe };
    });
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    const result = await subirLogo(formData);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      return;
    }
    setLogoUrl(result.url);
  }

  async function handleAddToCart() {
    if (!canAdd) return;
    setSaving(true);

    const design = markingConfig && logoUrl ? { logoFileUrl: logoUrl, markings: {}, previewImageUrl: logoUrl } : null;
    const designGroupId = crypto.randomUUID();
    const newItems = activeVariants.map((v) => {
      const qty = quantities[v.id]!;
      const p = pricing.get(v.id)!;
      return {
        productVariantId: v.id,
        productSlug,
        productName,
        size: v.size,
        color: v.color,
        image,
        quantity: qty,
        unitPrice: p.price!,
        garmentTier: p.tier,
        garment: { price: v.price, pricePack: v.pricePack, priceBox: v.priceBox, unitsPerPack, unitsPerCase, incompleteData },
        marking: markingConfig ? { ...markingConfig, garmentUnitCost: p.garmentPrice } : null,
        design,
        designGroupId,
        markColors: markingConfig && asksColor ? { pecho: frontColor || undefined, espalda: backActive ? backColor || undefined : undefined } : undefined,
      };
    });

    addItems(newItems);
    setSaving(false);
    setAdded(true);
    setQuantities({});
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-white p-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("stock")}
          className={`flex-1 cursor-pointer rounded-full border px-4 py-2 font-display text-xs font-bold transition-colors ${
            mode === "stock" ? "border-brand bg-brand text-white" : "border-border text-ink-soft hover:border-brand"
          }`}
        >
          Pedido de stock
        </button>
        <button
          type="button"
          onClick={() => setMode("personalizado")}
          className={`flex-1 cursor-pointer rounded-full border px-4 py-2 font-display text-xs font-bold transition-colors ${
            mode === "personalizado" ? "border-brand bg-brand text-white" : "border-border text-ink-soft hover:border-brand"
          }`}
        >
          Con personalización
        </button>
      </div>

      {mode === "stock" && <p className="mt-4 text-xs text-ink-soft">El producto tal cual, sin marcaje.</p>}

      {mode === "personalizado" && (
        <div className="mt-4 flex flex-col gap-3">
          {availableTechniques.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-soft">Técnica de estampado</span>
              <select
                value={technique}
                onChange={(e) => setTechnique(e.target.value as Technique)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
              >
                {availableTechniques.map((t) => (
                  <option key={t} value={t}>
                    {TECHNIQUE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsConsultation ? (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm text-ink-soft">
              Esta técnica requiere presupuesto a medida — no la calculamos online.{" "}
              <a href="/contacto" className="font-semibold text-brand hover:text-brand-dark">
                Escríbenos
              </a>{" "}
              y te lo preparamos.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border p-3">
                <span className="text-xs font-bold text-ink">Delante</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-soft">Colores</span>
                    <select
                      value={colors}
                      onChange={(e) => setColors(Number(e.target.value))}
                      className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
                    >
                      {[1, 2, 3].map((c) => (
                        <option key={c} value={c}>
                          {c} color{c > 1 ? "es" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-soft">Tamaño del marcaje</span>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value as PrintSize)}
                      className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
                    >
                      {SIZES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {asksColor && <ColorSelect value={frontColor} onChange={setFrontColor} />}
              </div>

              <div className={`rounded-xl border p-3 ${backActive ? "border-brand bg-brand-light" : "border-border"}`}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backActive}
                    onChange={(e) => setBackActive(e.target.checked)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="text-xs font-bold text-ink">Añadir marcaje detrás / otra cara</span>
                </label>
                {backActive && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-ink-soft">Colores</span>
                      <select
                        value={backColors}
                        onChange={(e) => setBackColors(Number(e.target.value))}
                        className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
                      >
                        {[1, 2, 3].map((c) => (
                          <option key={c} value={c}>
                            {c} color{c > 1 ? "es" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-ink-soft">Tamaño del marcaje</span>
                      <select
                        value={backSize}
                        onChange={(e) => setBackSize(e.target.value as PrintSize)}
                        className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
                      >
                        {SIZES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {backActive && asksColor && <ColorSelect value={backColor} onChange={setBackColorName} />}
              </div>
            </div>
          )}

          {!needsConsultation && (
            <div className="rounded-xl border border-border p-3">
              <span className="text-xs font-semibold text-ink-soft">Sube tu logo (opcional)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoSelect}
                className="mt-2 block w-full text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
              {uploading && <p className="mt-2 text-xs text-ink-soft">Subiendo…</p>}
              {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
              {logoUrl && <p className="mt-2 text-xs text-emerald-600">Logo recibido ✓</p>}
              <p className="mt-2 text-[11px] text-ink-soft">
                Este producto no tiene vista previa sobre maniquí — recibimos tu logo y te confirmamos la
                colocación antes de producir.
              </p>
            </div>
          )}
        </div>
      )}

      {(mode === "stock" || !needsConsultation) && (
        <div className="mt-5">
          <span className="text-xs font-semibold text-ink-soft">{sortedVariants.length > 1 ? "Cantidad por talla" : "Cantidad"}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {sortedVariants.map((v) => {
              const p = pricing.get(v.id);
              const qty = quantities[v.id] ?? 0;
              return (
                <div key={v.id} className="flex w-[4.5rem] flex-col items-center gap-1 rounded-xl border border-border p-2">
                  <span className="text-xs font-semibold text-ink">{v.size || "Única"}</span>
                  <input
                    type="number"
                    min={0}
                    value={qty || ""}
                    placeholder="0"
                    onChange={(e) => setQuantity(v.id, Number(e.target.value))}
                    className="w-full rounded-lg border border-border px-1 py-1 text-center text-sm text-ink"
                  />
                  <span className="text-center text-[10px] leading-tight text-ink-soft">
                    {qty > 0 && p?.price != null ? money(p.price) : v.stock <= 0 ? "Sin stock" : " "}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs text-ink-soft">{totalQuantity > 0 ? `${totalQuantity} unidades en total` : ""}</p>
        <div className="text-right">
          <p className="text-xs text-ink-soft">Subtotal</p>
          <p className="font-display text-xl font-extrabold text-ink">{totalQuantity > 0 ? money(subtotal) : "—"}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!canAdd || saving}
        className="mt-4 w-full cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Guardando…" : added ? "Añadido ✓" : "Añadir al carrito"}
      </button>
      {added && (
        <button
          type="button"
          onClick={() => router.push("/carrito")}
          className="mt-2 w-full cursor-pointer text-center font-display text-xs font-bold text-brand hover:text-brand-dark"
        >
          Ver carrito →
        </button>
      )}
    </div>
  );
}
