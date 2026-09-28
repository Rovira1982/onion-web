"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import {
  calculateQuote,
  type PrintSize,
  type PrintZone,
  type Technique,
} from "@/lib/pricing";
import LogoPositioner, { type ZoneTransforms } from "@/components/LogoPositioner";
import { subirLogo } from "@/app/producto/[slug]/actions";
import { ZONE_VIEW, type MarkZone } from "@/lib/garment-mockup";

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

// One panel per active zone (its own mockup view + the logo at that zone's
// transform), laid out side by side — a flat SVG mockup, not the product's
// own photo (that's on the supplier's CDN without CORS headers and would
// taint the canvas: toDataURL throws SecurityError on a cross-origin,
// non-CORS image).
async function renderZonesPreview(logoUrl: string, transforms: ZoneTransforms): Promise<string> {
  const zones = (Object.keys(transforms) as MarkZone[]).filter((z) => transforms[z]);
  const panel = 260;
  const canvas = document.createElement("canvas");
  canvas.width = panel * Math.max(zones.length, 1);
  canvas.height = panel;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#F4F1EC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const logo = await loadImage(logoUrl);

  zones.forEach((zone, i) => {
    const t = transforms[zone]!;
    const offsetX = i * panel;
    const scaleToPanel = panel / 300; // mockup paths use a 300x360 viewBox

    ctx.save();
    ctx.translate(offsetX, 0);
    ctx.scale(scaleToPanel, scaleToPanel);
    ctx.fillStyle = "#e8e5df";
    ctx.strokeStyle = "#c9c4ba";
    ctx.lineWidth = 2;
    const path = new Path2D(ZONE_VIEW[zone].path);
    ctx.fill(path);
    ctx.stroke(path);
    ctx.restore();

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

// Fixed business margin — the customer never sets their own margin, this
// mirrors the default already used across the presupuestador (Excel's own
// default, Margen_extra = 0.7).
const EXTRA_MARGIN = 0.7;

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

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function ZoneToggle({
  title,
  zone,
  onChange,
}: {
  title: string;
  zone: PrintZone;
  onChange: (z: PrintZone) => void;
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
        </div>
      )}
    </div>
  );
}

export default function AddToCartForm({
  productSlug,
  productName,
  image,
  variant,
}: {
  productSlug: string;
  productName: string;
  image: string;
  variant: { id: string; size: string; color: string; price: number; stock: number };
}) {
  const { addItem } = useCart();
  const router = useRouter();

  const [mode, setMode] = useState<"stock" | "personalizado">("stock");
  const [technique, setTechnique] = useState<Technique>("DTF");
  const [pecho, setPecho] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [espalda, setEspalda] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [mangas, setMangas] = useState<PrintZone>({ ...DEFAULT_ZONE });
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoTransforms, setLogoTransforms] = useState<ZoneTransforms>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);

  const noZoneActive = !pecho.active && !espalda.active && !mangas.active;
  const activeZones = [
    pecho.active && ("pecho" as const),
    espalda.active && ("espalda" as const),
    mangas.active && ("mangas" as const),
  ].filter((z): z is MarkZone => Boolean(z));

  const marking = useMemo(
    () =>
      mode === "personalizado"
        ? { technique, pecho, espalda, mangas: { ...mangas, multiplier: 1 }, garmentType: "Cliente" as const, garmentUnitCost: variant.price, quantity, extraMargin: EXTRA_MARGIN, personalizedName: false }
        : null,
    [mode, technique, pecho, espalda, mangas, variant.price, quantity]
  );

  const unitPrice = useMemo(() => {
    if (!marking) return variant.price;
    if (noZoneActive) return null;
    return calculateQuote(marking).finalUnitPrices.recommended;
  }, [marking, noZoneActive, variant.price]);

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

    let design: { logoFileUrl: string; markings: ZoneTransforms; previewImageUrl: string } | null = null;
    if (marking && logoUrl) {
      try {
        const previewDataUrl = await renderZonesPreview(logoUrl, logoTransforms);
        const previewFile = dataUrlToFile(previewDataUrl, "preview.png");
        const formData = new FormData();
        formData.append("file", previewFile);
        const result = await subirLogo(formData);
        if (!("error" in result)) {
          design = { logoFileUrl: logoUrl, markings: logoTransforms, previewImageUrl: result.url };
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
      marking,
      design,
    });
    setSaving(false);
    setAdded(true);
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

      {mode === "stock" ? (
        <p className="mt-4 text-sm text-ink-soft">El producto tal cual, sin marcaje. {money(variant.price)}/ud.</p>
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
          <div className="grid gap-2 sm:grid-cols-3">
            <ZoneToggle title="Pecho" zone={pecho} onChange={setPecho} />
            <ZoneToggle title="Espalda" zone={espalda} onChange={setEspalda} />
            <ZoneToggle title="Mangas" zone={mangas} onChange={setMangas} />
          </div>
          {noZoneActive && (
            <p className="text-xs text-brand-dark">Activa al menos una zona para ver el precio.</p>
          )}

          {!noZoneActive && (
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
                  <LogoPositioner zones={activeZones} logoUrl={logoUrl} onChange={setLogoTransforms} />
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
