"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { type QuoteInput } from "@/lib/pricing";
import { type PackDefinition } from "@/lib/packs";
import LogoPositioner, { type ZoneTransforms } from "@/components/LogoPositioner";
import { subirLogo } from "@/app/producto/[slug]/actions";
import { loadImage, dataUrlToFile, renderZonesPreview, type FormVariant } from "@/components/AddToCartForm";
import { MOCKUP_GARMENTS, MOCKUP_COLORS, type MockupGarment, type MockupColor } from "@/lib/garment-mockup";

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

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Marcaje interno del pack — no se calcula precio a partir de esto (el
// precio es el fijo del pack, ver src/lib/packs.ts). Solo sirve para
// capturar el logo/posición de cara a producción, igual que hace el
// configurador normal. Tamaños en el tramo más cercano de la tarifa
// (10x10/28x28) — no afecta al precio del pack, es puramente informativo.
function fixedMarkingConfig(quantity: number): QuoteInput {
  return {
    technique: "DTF",
    pecho: { active: true, colors: 1, size: "10x10" },
    espalda: { active: true, colors: 1, size: "28x28" },
    mangas: { active: false, colors: 1, size: "10x10" },
    garmentType: "Cliente",
    garmentUnitCost: 0,
    quantity,
    extraMargin: 0,
    personalizedName: false,
  };
}

export default function PackAddToCartForm({
  productSlug,
  productName,
  image,
  variants,
  pack,
}: {
  productSlug: string;
  productName: string;
  image: string;
  variants: FormVariant[];
  pack: PackDefinition;
}) {
  const { addItems } = useCart();
  const router = useRouter();
  const sortedVariants = sortVariantsBySize(variants);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoTransforms, setLogoTransforms] = useState<ZoneTransforms>({});
  const [mockupGarment, setMockupGarment] = useState<MockupGarment>("camiseta");
  const [mockupColor, setMockupColor] = useState<MockupColor>("blanco");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);

  const totalQuantity = Object.values(quantities).reduce((sum, q) => sum + q, 0);
  const canAdd = totalQuantity === pack.quantity;
  // Precio SIN IVA — igual que el resto del carrito (ver carrito/page.tsx:
  // "El IVA se calcula en el siguiente paso"), para que el total que
  // checkout calcula sumando +21% vuelva a dar pack.totalPrice (con IVA
  // incluido), en vez de aplicar el IVA dos veces. Debe coincidir con la
  // misma cuenta del servidor en checkout/actions.ts.
  const unitPrice = Math.round((pack.totalPrice / 1.21 / pack.quantity) * 100) / 100;

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
    setLogoTransforms({});
  }

  async function handleAddToCart() {
    if (!canAdd) return;
    setSaving(true);

    const marking = fixedMarkingConfig(pack.quantity);
    let design: {
      logoFileUrl: string;
      markings: Partial<Record<"pecho" | "espalda", { x: number; y: number; scale: number; rotation: number }>>;
      previewImageUrl: string;
    } | null = null;
    if (logoUrl) {
      try {
        const previewDataUrl = await renderZonesPreview(logoUrl, logoTransforms, mockupGarment, mockupColor);
        const previewFile = dataUrlToFile(previewDataUrl, "preview.png");
        const formData = new FormData();
        formData.append("file", previewFile);
        const result = await subirLogo(formData);
        if (!("error" in result)) {
          design = { logoFileUrl: logoUrl, markings: logoTransforms, previewImageUrl: result.url };
        }
      } catch {
        // Preview generation/upload failed — still add the pack, just
        // without a rendered thumbnail.
      }
    }

    const designGroupId = crypto.randomUUID();
    const activeVariants = sortedVariants.filter((v) => (quantities[v.id] ?? 0) > 0);
    const newItems = activeVariants.map((v) => ({
      productVariantId: v.id,
      productSlug,
      productName,
      size: v.size,
      color: v.color,
      image,
      quantity: quantities[v.id]!,
      unitPrice,
      garmentTier: "unidad" as const,
      garment: { price: v.price, pricePack: v.pricePack, priceBox: v.priceBox, unitsPerPack: null, unitsPerCase: null, incompleteData: false },
      marking,
      design,
      designGroupId,
      packCode: pack.code,
    }));

    addItems(newItems);
    setSaving(false);
    setAdded(true);
    setQuantities({});
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 rounded-2xl border border-brand bg-brand-light p-5">
      <p className="font-display text-sm font-bold text-ink">Pack cerrado — {money(pack.totalPrice)}</p>
      <p className="mt-1 text-xs text-ink-soft">
        Logo delante y logo detrás incluidos. Elige el color y reparte las {pack.quantity} unidades entre tallas.
      </p>

      <div className="mt-4">
        <span className="text-xs font-semibold text-ink-soft">Tallas (deben sumar {pack.quantity} unidades)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {sortedVariants.map((v) => (
            <div key={v.id} className="flex w-[4.5rem] flex-col items-center gap-1 rounded-xl border border-border bg-white p-2">
              <span className="text-xs font-semibold text-ink">{v.size || "Única"}</span>
              <input
                type="number"
                min={0}
                value={quantities[v.id] || ""}
                placeholder="0"
                onChange={(e) => setQuantity(v.id, Number(e.target.value))}
                className="w-full rounded-lg border border-border px-1 py-1 text-center text-sm text-ink"
              />
            </div>
          ))}
        </div>
        <p className={`mt-2 text-xs font-semibold ${canAdd ? "text-emerald-600" : "text-brand-dark"}`}>
          {totalQuantity} / {pack.quantity} unidades
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-white p-3">
        <span className="text-xs font-semibold text-ink-soft">Sube tu logo (opcional)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleLogoSelect}
          className="mt-2 block w-full text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
        {uploading && <p className="mt-2 text-xs text-ink-soft">Subiendo…</p>}
        {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
        {logoUrl && (
          <div className="mt-3">
            <div className="mb-2 flex gap-2">
              <select
                value={mockupGarment}
                onChange={(e) => setMockupGarment(e.target.value as MockupGarment)}
                className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
              >
                {MOCKUP_GARMENTS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <select
                value={mockupColor}
                onChange={(e) => setMockupColor(e.target.value as MockupColor)}
                className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
              >
                {MOCKUP_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <LogoPositioner
              zones={["pecho", "espalda"]}
              logoUrl={logoUrl}
              garment={mockupGarment}
              color={mockupColor}
              onChange={setLogoTransforms}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs text-ink-soft">10 unidades, mismo color</p>
        <div className="text-right">
          <p className="text-xs text-ink-soft">Total del pack</p>
          <p className="font-display text-xl font-extrabold text-ink">{money(pack.totalPrice)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!canAdd || saving}
        className="mt-4 w-full cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Guardando…" : added ? "Añadido ✓" : "Añadir pack al carrito"}
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
