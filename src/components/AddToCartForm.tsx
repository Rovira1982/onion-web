"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { type PrintSize, type PrintZone, type Technique } from "@/lib/pricing";
import { personalizedUnitPrice, PERSONALIZED_EXTRA_MARGIN } from "@/lib/line-price";
import { selectGarmentTier, type GarmentTier } from "@/lib/garment-price";
import LogoPositioner, { type ZoneTransforms } from "@/components/LogoPositioner";
import { subirLogo } from "@/app/producto/[slug]/actions";
import {
  mockupImageUrl,
  MOCKUP_GARMENTS,
  MOCKUP_COLORS,
  type MarkZone,
  type MockupGarment,
  type MockupColor,
} from "@/lib/garment-mockup";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

// One panel per active zone (its own mockup photo + the logo at that
// zone's transform), laid out side by side. The mockup photos are our own
// (public/mockups/), same-origin, so drawImage/toDataURL never hits the
// canvas-taint issue a supplier's own CDN photo would.
async function renderZonesPreview(
  logoUrl: string,
  transforms: ZoneTransforms,
  garment: MockupGarment,
  color: MockupColor
): Promise<string> {
  const zones = (Object.keys(transforms) as MarkZone[]).filter((z) => transforms[z]);
  const panel = 260;
  const canvas = document.createElement("canvas");
  canvas.width = panel * Math.max(zones.length, 1);
  canvas.height = panel;
  const ctx = canvas.getContext("2d")!;
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue("--color-muted").trim() || "#faf5f0";
  ctx.fillStyle = mutedColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const logo = await loadImage(logoUrl);
  const mockups = await Promise.all(zones.map((zone) => loadImage(mockupImageUrl(garment, color, zone))));

  zones.forEach((zone, i) => {
    const t = transforms[zone]!;
    const offsetX = i * panel;
    const mockup = mockups[i];

    const mockupRatio = Math.min(panel / mockup.width, panel / mockup.height);
    const mw = mockup.width * mockupRatio;
    const mh = mockup.height * mockupRatio;
    ctx.drawImage(mockup, offsetX + (panel - mw) / 2, (panel - mh) / 2, mw, mh);

    const box = panel * 0.4;
    const ratio = Math.min(box / logo.width, box / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;

    ctx.save();
    ctx.translate(offsetX + panel / 2 + t.x * (panel / 300), panel / 2 + t.y * (panel / 300));
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(t.scale, t.scale);
    ctx.drawImage(logo, -w / 2, -h / 2, w, h);
    ctx.restore();
  });

  return canvas.toDataURL("image/png");
}

const TECHNIQUES: { value: Technique; label: string }[] = [
  { value: "DTF", label: "DTF (transferencia digital)" },
  { value: "Serigrafia", label: "Serigrafía" },
  { value: "Vinilo", label: "Vinilo (corte y termotransferencia)" },
  { value: "Sublimacion", label: "Sublimación" },
];

const SIZES: { value: PrintSize; label: string }[] = [
  { value: "10x10", label: "10×10 cm" },
  { value: "23x23", label: "23×23 cm" },
  { value: "30x30", label: "30×30 cm" },
];

const DEFAULT_ZONE: PrintZone = { active: false, colors: 1, size: "10x10" };

// DTF y Sublimación imprimen a todo color directamente desde el logo subido
// — solo Serigrafía y Vinilo necesitan saber qué color de tinta/vinilo usar.
const NEEDS_COLOR_NAME: Record<Technique, boolean> = {
  DTF: false,
  Sublimacion: false,
  Serigrafia: true,
  Vinilo: true,
};

// Vinilo requiere presupuesto a medida — no se calcula precio online para
// esta técnica, se dirige al cliente a contacto en su lugar.
const REQUIRES_CONSULTATION: Record<Technique, boolean> = {
  DTF: false,
  Sublimacion: false,
  Serigrafia: false,
  Vinilo: true,
};

const COLOR_PALETTE = [
  "Blanco",
  "Negro",
  "Rojo",
  "Azul",
  "Amarillo",
  "Verde",
  "Naranja",
  "Rosa",
  "Gris",
  "Dorado",
  "Plateado",
];

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function ZoneToggle({
  title,
  zone,
  onChange,
  showColorName,
  colorName,
  onColorNameChange,
}: {
  title: string;
  zone: PrintZone;
  onChange: (z: PrintZone) => void;
  showColorName: boolean;
  colorName: string;
  onColorNameChange: (color: string) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 ${zone.active ? "border-brand bg-brand-light" : "border-border bg-white"}`}>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <input
          type="checkbox"
          checked={zone.active}
          onChange={(e) => onChange({ ...zone, active: e.target.checked })}
          className="h-5 w-5 accent-brand"
        />
      </label>
      {zone.active && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={zone.colors}
            onChange={(e) => onChange({ ...zone, colors: Number(e.target.value) })}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
          >
            {[1, 2, 3].map((c) => (
              <option key={c} value={c}>
                {c} color{c > 1 ? "es" : ""}
              </option>
            ))}
          </select>
          <select
            value={zone.size}
            onChange={(e) => onChange({ ...zone, size: e.target.value as PrintSize })}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {showColorName && (
            <select
              value={colorName}
              onChange={(e) => onColorNameChange(e.target.value)}
              className="col-span-2 rounded-lg border border-border px-2 py-1.5 text-xs text-ink"
            >
              <option value="">Color del marcaje…</option>
              {COLOR_PALETTE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

// The "Con personalización" configurator below only has real mockup photos
// for T-shirt/hoodie-shaped garments (pecho/espalda/mangas) — see
// src/lib/garment-mockup.ts. Showing it on a gorra, taza or llavero would
// display the wrong silhouette and zones (flagged in
// docs/auditoria-ux-2026-09-29.md, hallazgo "Zonas de personalización no se
// adaptan al tipo de producto"). Until we have mockups per category, gate it
// to categories where the torso zones genuinely apply; everything else
// falls back to the existing "pide presupuesto por email" link below.
const GARMENT_KEYWORDS = [
  "camiseta",
  "camisa",
  "sudadera",
  "polo",
  "chaqueta",
  "chaleco",
  "chándal",
  "chandal",
  "jersey",
  "softshell",
  "cortavientos",
  "parka",
  "cazadora",
  "top",
];

function isGarmentCategory(category: string): boolean {
  const lower = category.toLowerCase();
  return GARMENT_KEYWORDS.some((k) => lower.includes(k));
}

export default function AddToCartForm({
  productSlug,
  productName,
  image,
  variant,
  unitsPerPack,
  unitsPerCase,
  incompleteData,
  category,
}: {
  productSlug: string;
  productName: string;
  image: string;
  variant: { id: string; size: string; color: string; price: number; pricePack: number | null; priceBox: number | null; stock: number };
  unitsPerPack: number | null;
  unitsPerCase: number | null;
  incompleteData: boolean;
  category: string;
}) {
  const canPersonalize = isGarmentCategory(category);
  const { addItem } = useCart();
  const router = useRouter();

  const [mode, setMode] = useState<"stock" | "personalizado">("stock");
  const [technique, setTechnique] = useState<Technique>("DTF");
  const [pecho, setPecho] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [espalda, setEspalda] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [mangas, setMangas] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [mangaIzquierda, setMangaIzquierda] = useState(false);
  const [mangaDerecha, setMangaDerecha] = useState(false);
  const [mockupGarment, setMockupGarment] = useState<MockupGarment>("camiseta");
  const [mockupColor, setMockupColor] = useState<MockupColor>("blanco");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoTransforms, setLogoTransforms] = useState<ZoneTransforms>({});
  const [markColors, setMarkColors] = useState<Partial<Record<MarkZone, string>>>({});
  const needsColorName = NEEDS_COLOR_NAME[technique];
  const needsConsultation = REQUIRES_CONSULTATION[technique];
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);

  const noZoneActive = !pecho.active && !espalda.active && !mangas.active;
  const activeZones = [
    pecho.active && ("pecho" as const),
    espalda.active && ("espalda" as const),
    mangas.active && mangaIzquierda && ("manga_izquierda" as const),
    mangas.active && mangaDerecha && ("manga_derecha" as const),
  ].filter((z): z is MarkZone => Boolean(z));

  // Nº de mangas a estampar lo decide qué lado(s) coloca el cliente en el
  // posicionador — por defecto 1 si activa "Mangas" pero aún no ha elegido
  // lado, para no cobrar 0.
  const mangasMultiplier = Math.max(1, (mangaIzquierda ? 1 : 0) + (mangaDerecha ? 1 : 0));

  const garmentPricing = useMemo(
    () =>
      selectGarmentTier(
        {
          price: variant.price,
          pricePack: variant.pricePack,
          priceBox: variant.priceBox,
          unitsPerPack,
          unitsPerCase,
          incompleteData,
        },
        quantity
      ),
    [variant.price, variant.pricePack, variant.priceBox, unitsPerPack, unitsPerCase, incompleteData, quantity]
  );

  const marking = useMemo(
    () =>
      mode === "personalizado"
        ? {
            technique,
            pecho,
            espalda,
            mangas: { ...mangas, multiplier: mangasMultiplier },
            garmentType: "Cliente" as const,
            garmentUnitCost: garmentPricing.price,
            quantity,
            extraMargin: PERSONALIZED_EXTRA_MARGIN,
            personalizedName: false,
          }
        : null,
    [mode, technique, pecho, espalda, mangas, mangasMultiplier, garmentPricing.price, quantity]
  );

  const unitPrice = useMemo(() => {
    if (!marking) return garmentPricing.price;
    if (noZoneActive || needsConsultation) return null;
    return personalizedUnitPrice(marking, garmentPricing.price);
  }, [marking, noZoneActive, needsConsultation, garmentPricing.price]);

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
    if (unitPrice === null) return;
    setSaving(true);

    let design: {
      logoFileUrl: string;
      markings: Partial<Record<MarkZone, { x: number; y: number; scale: number; rotation: number; colorName?: string }>>;
      previewImageUrl: string;
    } | null = null;
    if (marking && logoUrl) {
      try {
        const previewDataUrl = await renderZonesPreview(logoUrl, logoTransforms, mockupGarment, mockupColor);
        const previewFile = dataUrlToFile(previewDataUrl, "preview.png");
        const formData = new FormData();
        formData.append("file", previewFile);
        const result = await subirLogo(formData);
        if (!("error" in result)) {
          const markings = Object.fromEntries(
            (Object.keys(logoTransforms) as MarkZone[]).map((zone) => [
              zone,
              { ...logoTransforms[zone]!, ...(needsColorName && markColors[zone] ? { colorName: markColors[zone] } : {}) },
            ])
          );
          design = { logoFileUrl: logoUrl, markings, previewImageUrl: result.url };
        }
      } catch {
        // Preview generation/upload failed — still add the item with the
        // logo and its coordinates, just without a rendered thumbnail.
      }
    }

    addItem({
      productVariantId: variant.id,
      productSlug,
      productName,
      size: variant.size,
      color: variant.color,
      image,
      quantity,
      unitPrice,
      garmentTier: garmentPricing.tier,
      garment: {
        price: variant.price,
        pricePack: variant.pricePack,
        priceBox: variant.priceBox,
        unitsPerPack,
        unitsPerCase,
        incompleteData,
      },
      marking,
      design,
    });
    setSaving(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-white p-5">
      {canPersonalize ? (
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
      ) : (
        <p className="text-sm text-ink-soft">
          ¿Quieres este artículo personalizado con tu logo? Este configurador aún no está preparado para esta
          categoría — usa el botón de "pedir presupuesto por email" más abajo y te lo preparamos a medida.
        </p>
      )}

      {mode === "stock" || !canPersonalize ? (
        <p className="mt-4 text-sm text-ink-soft">
          El producto tal cual, sin marcaje. {money(garmentPricing.price)}/ud.
          {garmentPricing.tier !== "unidad" && (
            <span className="ml-1 text-xs text-brand">
              (precio de {garmentPricing.tier} a partir de{" "}
              {garmentPricing.tier === "caja" ? unitsPerCase : unitsPerPack} uds)
            </span>
          )}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">Técnica de estampado</span>
            <select
              value={technique}
              onChange={(e) => setTechnique(e.target.value as Technique)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              {TECHNIQUES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {technique === "Sublimacion" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ Sublimación solo disponible en prendas de poliéster y colores claros.
            </p>
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
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <ZoneToggle
                  title="Pecho"
                  zone={pecho}
                  onChange={setPecho}
                  showColorName={needsColorName}
                  colorName={markColors.pecho ?? ""}
                  onColorNameChange={(c) => setMarkColors((prev) => ({ ...prev, pecho: c }))}
                />
                <ZoneToggle
                  title="Espalda"
                  zone={espalda}
                  onChange={setEspalda}
                  showColorName={needsColorName}
                  colorName={markColors.espalda ?? ""}
                  onColorNameChange={(c) => setMarkColors((prev) => ({ ...prev, espalda: c }))}
                />
                <ZoneToggle
                  title="Mangas"
                  zone={mangas}
                  onChange={setMangas}
                  showColorName={needsColorName}
                  colorName={markColors.manga_izquierda ?? markColors.manga_derecha ?? ""}
                  onColorNameChange={(c) => setMarkColors((prev) => ({ ...prev, manga_izquierda: c, manga_derecha: c }))}
                />
              </div>
              {mangas.active && (
                <div className="flex gap-4 text-sm text-ink">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mangaIzquierda}
                      onChange={(e) => setMangaIzquierda(e.target.checked)}
                      className="h-4 w-4 accent-brand"
                    />
                    Manga izquierda
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mangaDerecha}
                      onChange={(e) => setMangaDerecha(e.target.checked)}
                      className="h-4 w-4 accent-brand"
                    />
                    Manga derecha
                  </label>
                </div>
              )}
              {noZoneActive && (
                <p className="text-xs text-brand-dark">Activa al menos una zona para ver el precio.</p>
              )}
            </>
          )}

          {!noZoneActive && !needsConsultation && (
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
              {logoUrl && activeZones.length > 0 && (
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
                    zones={activeZones}
                    logoUrl={logoUrl}
                    garment={mockupGarment}
                    color={mockupColor}
                    onChange={setLogoTransforms}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">Cantidad</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-24 rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </label>
        <div className="flex-1 text-right">
          <p className="text-xs text-ink-soft">Precio por unidad</p>
          <p className="font-display text-xl font-extrabold text-ink">
            {unitPrice === null ? "—" : money(unitPrice)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={unitPrice === null || saving}
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
