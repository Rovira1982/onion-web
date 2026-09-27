import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

// Product data layer.
//
// Source: a point-in-time export of Cifra's real catalog (data/cifra-products.csv,
// same columns as the Cifra Catalog API: https://api.cifrashop.com/products/:TOKEN/:LANG).
// To go live, replace loadRawRows() below with a fetch to that endpoint using a
// real CIFRA_API_TOKEN — the row shape is the same, so nothing downstream changes.
type CifraCsvRow = {
  Modelo: string;
  "Modelo raíz": string;
  Nombre: string;
  Descripción: string;
  Categoría: string;
  SubCategoría: string;
  Imagen: string;
  Stock: string;
  Precio: string;
  Material: string;
  "Técnica Grabación": string;
  "Medida Grabación": string;
  Color: string;
};

export type Product = {
  slug: string;
  model: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  image: string;
  price: number;
  stock: number;
  material: string;
  engravingTechnique: string;
  color: string;
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

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function fromCsvRow(row: CifraCsvRow): Product {
  const name = stripHtml(row.Nombre).trim();
  const category = stripHtml(row.Categoría).trim() || FALLBACK_CATEGORY;
  return {
    slug: slugify(`${name}-${row.Modelo}`),
    model: row.Modelo,
    name,
    description: stripHtml(row.Descripción) || `${name}, personalizable con tu logo.`,
    category,
    subcategory: stripHtml(row.SubCategoría),
    image: row.Imagen,
    price: parseFloat(row.Precio) || 0,
    stock: parseInt(row.Stock, 10) || 0,
    material: stripHtml(row.Material),
    engravingTechnique: row["Técnica Grabación"]?.trim() ?? "",
    color: row.Color?.trim() ?? "",
  };
}

let cache: Product[] | null = null;

function loadRawRows(): CifraCsvRow[] {
  const csvPath = path.join(process.cwd(), "data", "cifra-products.csv");
  const file = fs.readFileSync(csvPath, "utf-8");
  const { data } = Papa.parse<CifraCsvRow>(file, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  });
  return data;
}

export function getProducts(): Product[] {
  if (!cache) {
    cache = loadRawRows()
      .map(fromCsvRow)
      .filter((p) => p.name && p.model);
  }
  return cache;
}

export function getInStockProducts(): Product[] {
  return getProducts().filter((p) => p.stock > 0);
}

export function getProductBySlug(slug: string): Product | undefined {
  return getProducts().find((p) => p.slug === slug);
}

export function getCategories(): { name: string; slug: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of getInStockProducts()) {
    map.set(p.category, (map.get(p.category) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, slug: slugify(name), count }))
    .sort((a, b) => b.count - a.count);
}

export function getTopCategories(limit = 8) {
  return getCategories()
    .filter((c) => c.name !== FALLBACK_CATEGORY)
    .slice(0, limit);
}

export function getProductsByCategorySlug(categorySlug: string): Product[] {
  return getInStockProducts().filter((p) => slugify(p.category) === categorySlug);
}

// No real sales data yet — samples a spread across top categories as a
// stand-in "bestsellers" shelf until Cifra order/sales data is available.
export function getFeaturedProducts(limit = 8): Product[] {
  const topCats = getTopCategories(limit);
  const picks: Product[] = [];
  for (const cat of topCats) {
    const product = getProductsByCategorySlug(cat.slug)[0];
    if (product) picks.push(product);
    if (picks.length >= limit) break;
  }
  return picks;
}

const PAGE_SIZE = 24;

export function searchProducts(opts: { category?: string; q?: string; page?: number }) {
  let products = getInStockProducts();

  if (opts.category) {
    products = products.filter((p) => slugify(p.category) === opts.category);
  }
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.subcategory.toLowerCase().includes(needle)
    );
  }

  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;

  return {
    products: products.slice(start, start + PAGE_SIZE),
    total,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
  };
}
