// Pure, client-safe product helpers (types + formatting). No database import
// here — this file gets bundled into the browser via ProductDetailClient, so
// it must never pull in "server-only" or the Prisma/pg driver stack.

export type Product = {
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  image: string;
  price: number;
  stock: number;
  material: string;
  engravingTechnique: string;
};

export type ProductVariant = {
  id: string;
  size: string;
  color: string;
  price: number;
  stock: number;
  supplierModelCode: string;
};

export type ProductDetail = Product & { variants: ProductVariant[] };

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
