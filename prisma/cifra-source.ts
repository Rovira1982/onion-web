// Live data source for the Cifra import (prisma/import-cifra.ts). Pulls the
// confidential (wholesale/cost) pricelist from Cifra's own API — confirmed
// live 2026-09-29, see .env.local for CIFRA_API_BASE_URL / CIFRA_API_TOKEN
// (generated from "Mi cuenta" -> "Integraciones API" on cifra.es).
//
// Replaces the earlier one-time CSV parsing (data/cifra-products.csv, no
// longer used) — the API gives the same shape plus structured color, extra
// images, and a stock figure per SKU, all live instead of a stale export.
//
// Deliberately no "server-only" guard (unlike src/lib/gorfactory.ts) — this
// file is only ever imported by prisma/import-cifra.ts, run directly via
// `npx tsx` outside Next's server context, where that guard would throw.


// Confidential-price endpoint (our cost) — confirmed live: `price_pvp` on
// the separate /products endpoint is always exactly confidential_price × 2,
// i.e. Cifra's own suggested retail already matches the ×2 margin we apply
// ourselves elsewhere (Roly/Stamina) — so we read the net cost here and let
// import-cifra.ts apply our own MARGEN constant, same architecture as
// prisma/import-roly.ts, rather than trusting Cifra's own PVP field.
type CifraApiItem = {
  model: string;
  rootmodel: string;
  name: string;
  description: string;
  parent_category: string;
  category: string;
  image: string;
  images: string[];
  quantity: string;
  confidential_price: string; // comma decimal, e.g. "0,61"
  color: { id: string; name: string; rgb_hex: string } | null;
  material: string;
  tgrabacion: string;
};

export type CifraRow = {
  slug: string;
  model: string;
  rootmodel: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  image: string;
  images: string[];
  price: number; // net/confidential cost — margin applied by the caller
  stock: number;
  material: string;
  engravingTechnique: string;
  size: string;
  colorLabel: string;
};

const FALLBACK_CATEGORY = "Otros artículos";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stripHtml(input: string | null | undefined) {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNet(price: string | null | undefined): number {
  if (!price) return 0;
  const n = parseFloat(price.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const SIZE_TOKENS = new Set(["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL"]);

// The API gives structured color but not size — same suffix-scan fallback
// as the old CSV parser, for the handful of Cifra items that are clothing.
function parseSizeFromModel(model: string): string {
  const tokens = model.split("-").filter(Boolean);
  const rest = tokens.length > 1 ? tokens.slice(1) : tokens;
  const idx = rest.findIndex((t) => SIZE_TOKENS.has(t.toUpperCase()));
  return idx !== -1 ? rest[idx].toUpperCase() : "";
}

function fromApiItem(item: CifraApiItem): CifraRow {
  const name = stripHtml(item.name);
  const category = stripHtml(item.parent_category) || FALLBACK_CATEGORY;
  return {
    slug: slugify(`${name}-${item.model}`),
    model: item.model,
    rootmodel: item.rootmodel?.trim() || item.model,
    name,
    description: stripHtml(item.description) || `${name}, personalizable con tu logo.`,
    category,
    subcategory: stripHtml(item.category),
    image: item.image,
    images: item.images ?? [],
    price: parseNet(item.confidential_price),
    stock: parseInt(item.quantity, 10) || 0,
    material: stripHtml(item.material),
    engravingTechnique: item.tgrabacion?.trim() ?? "",
    size: parseSizeFromModel(item.model),
    colorLabel: item.color?.name ?? "",
  };
}

let cache: CifraRow[] | null = null;

async function loadAllRows(): Promise<CifraRow[]> {
  if (!cache) {
    const token = process.env.CIFRA_API_TOKEN;
    const baseUrl = process.env.CIFRA_API_BASE_URL ?? "https://api.cifrashop.com";
    if (!token) throw new Error("CIFRA_API_TOKEN no configurado en .env.local");
    const res = await fetch(`${baseUrl}/tariff/${token}/es`);
    if (!res.ok) throw new Error(`Cifra API falló: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as CifraApiItem[];
    cache = data.map(fromApiItem).filter((p) => p.name && p.model);
  }
  return cache;
}

function groupKey(p: CifraRow) {
  return `${p.category}||${p.name}`;
}

// One representative (highest-stock) row per (category, name) family, plus
// every variant (including out-of-stock ones) that shares that family.
export async function getCifraFamilies(): Promise<{ representative: CifraRow; variants: CifraRow[] }[]> {
  const all = await loadAllRows();
  const rows = all.filter((r) => r.stock > 0);
  const byKey = new Map<string, CifraRow[]>();
  for (const r of rows) {
    const key = groupKey(r);
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }

  return Array.from(byKey.entries()).map(([key, familyReps]) => {
    const representative = familyReps.slice().sort((a, b) => b.stock - a.stock)[0];
    const allVariants = all.filter((r) => groupKey(r) === key);
    return { representative, variants: allVariants };
  });
}
