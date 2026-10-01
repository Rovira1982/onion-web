// Pure, client-safe product helpers (types + formatting). No database import
// here — this file gets bundled into the browser via ProductDetailClient, so
// it must never pull in "server-only" or the Prisma/pg driver stack.

export type Product = {
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  brand: string;
  image: string;
  price: number;
  stock: number;
  material: string;
  engravingTechnique: string;
  // Maestro de precios (Finanzas, 2026-09-30) — tramos de cantidad a nivel
  // de modelo. Null = sin dato; incompleteData=true fuerza precio de unidad
  // siempre (regla de repliegue, ver src/lib/garment-price.ts).
  unitsPerPack: number | null;
  unitsPerCase: number | null;
  incompleteData: boolean;
};

export type ProductVariant = {
  id: string;
  size: string;
  color: string;
  price: number;
  pricePack: number | null;
  priceBox: number | null;
  stock: number;
  supplierModelCode: string;
};

export type ProductImageDetail = { url: string; color: string | null };

export type ProductDetail = Product & {
  variants: ProductVariant[];
  // Todas las fotos del producto (la ficha muestra galería) — `image` sigue
  // siendo solo la primera, para los sitios que ya la usan (tarjetas, OG).
  // `color` liga una foto a un color concreto (ej. Roly) — null = foto
  // genérica, se muestra en la galería para cualquier color.
  images: ProductImageDetail[];
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Best-effort translation of Cifra's engraving/printing technique codes into
// customer-facing Spanish labels. Only codes we're confident about are
// mapped; anything else is shown as-is rather than guessing, since telling a
// customer the wrong personalization technique is worse than an unclear code.
const TECHNIQUE_LABELS: Record<string, string> = {
  DTF: "Impresión DTF",
  DIGITAL: "Impresión digital",
  BORDADO: "Bordado",
  BORDA: "Bordado",
  LCO1: "Láser CO2",
  LCO2: "Láser CO2",
  L360: "Grabado láser 360°",
  "GOTA DE RESINA": "Gota de resina",
  "VINILO DIGITAL/CORTE": "Vinilo digital / corte",
  SUB1: "Sublimación",
  SUB2: "Sublimación",
  SUBP: "Sublimación",
  "SE SIRVE SIN MARCAJE": "Sin personalización disponible",
  "SE SIRVE SIN MARCAR": "Sin personalización disponible",
};

// Subconjunto de códigos de arriba que además sabemos mapear a una de las
// 4 técnicas que calcula el presupuestador (src/lib/pricing.ts) — no todo
// lo que el proveedor marca como "personalizable" tiene precio online
// (bordado, láser, etc. no están soportados hoy), así que solo se ofrece
// marcaje en la ficha cuando el código es uno de estos, nunca se adivina.
const ONLINE_TECHNIQUE_CODES: Record<string, "DTF" | "Serigrafia" | "Vinilo" | "Sublimacion"> = {
  DTF: "DTF",
  SUB1: "Sublimacion",
  SUB2: "Sublimacion",
  SUBP: "Sublimacion",
  "VINILO DIGITAL/CORTE": "Vinilo",
};

export function parseOnlineTechniques(raw: string): ("DTF" | "Serigrafia" | "Vinilo" | "Sublimacion")[] {
  if (!raw) return [];
  const parts = raw.split(",").map((p) => p.trim());
  const techniques = parts.map((p) => ONLINE_TECHNIQUE_CODES[p]).filter((t): t is "DTF" | "Serigrafia" | "Vinilo" | "Sublimacion" => Boolean(t));
  return Array.from(new Set(techniques));
}

export function describeEngravingTechnique(raw: string): string {
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const labels = parts.map((p) => TECHNIQUE_LABELS[p] ?? p);
  return Array.from(new Set(labels)).join(" · ");
}

// Valento's characteristics.composicion (and composicion-exterior/-interior)
// packs each material as "percentage_material", multiple materials joined
// by "##" and no accents (e.g. "65_poliester##35_algodon"). Everything else
// (Cifra, TopTex) already stores plain, human-readable text and passes
// through unchanged.
const MATERIAL_NAME_LABELS: Record<string, string> = {
  poliester: "poliéster",
  algodon: "algodón",
  algodon_organico: "algodón orgánico",
  poliamida: "poliamida",
  elastano: "elastano",
  viscosa: "viscosa",
  lana: "lana",
  acrilico: "acrílico",
  nylon: "nailon",
  spandex: "spandex",
  lino: "lino",
  cuero: "cuero",
  pu: "poliuretano",
  pvc: "PVC",
};

export function describeMaterial(raw: string): string {
  if (!raw) return "";
  if (!raw.includes("##") && !/^\d+_/.test(raw)) return raw;
  return raw
    .split("##")
    .map((part) => {
      const [pct, ...nameParts] = part.split("_");
      const name = nameParts.join("_").toLowerCase();
      const label = MATERIAL_NAME_LABELS[name] ?? name;
      return /^\d+$/.test(pct) ? `${pct}% ${label.charAt(0).toUpperCase()}${label.slice(1)}` : part;
    })
    .join(" / ");
}
