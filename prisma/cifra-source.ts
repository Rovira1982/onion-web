// One-time CSV parsing for the Cifra import (prisma/import-cifra.ts).
// Deliberately separate from src/lib/products.ts, which now reads from the
// database — this file is only ever used to populate that database in the
// first place (or to re-sync from a refreshed CSV export later).
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

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
  Color: string;
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
  price: number;
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

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    // Cifra's export drops paragraph/list breaks, sometimes leaving an
    // invisible word-joiner in their place ("bandera⁠Para pedidos..."), other
    // times leaving no separator at all ("bañoIncorpora un gancho...").
    // Word-joiner runs become a sentence break; a lowercase word of 4+
    // letters running straight into a capital does too — long enough to
    // avoid false positives on real abbreviations (mAh, cm, kg, V...) that
    // also butt up against a capital letter.
    .replace(/[⁠​﻿]+/g, ". ")
    .replace(/\.(?=[A-ZÁÉÍÓÚÑ])/g, ". ")
    .replace(/([a-zà-ÿñ]{4,})([A-ZÁÉÍÓÚÑ])/g, "$1. $2")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

const SIZE_TOKENS = new Set(["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL"]);

function parseVariantSuffix(modelo: string): { size: string; colorLabel: string } {
  const tokens = modelo.split("-").filter(Boolean);
  const rest0 = tokens.length > 1 ? tokens.slice(1) : tokens;

  if (rest0.length >= 2 && /^\d+$/.test(rest0[0]) && /^\d+$/.test(rest0[1])) {
    return { size: `${rest0[0]}-${rest0[1]}`, colorLabel: rest0.slice(2).join("-") };
  }

  // The size token isn't always right after the prefix — some models carry an
  // extra sub-model code first (e.g. "T-661-L-MA": prefix T, sub-model 661,
  // size L, color MA). Scan the remaining tokens for a recognized size.
  const sizeIdx = rest0.findIndex((t) => SIZE_TOKENS.has(t.toUpperCase()));
  if (sizeIdx !== -1) {
    return { size: rest0[sizeIdx].toUpperCase(), colorLabel: rest0.slice(sizeIdx + 1).join("-") };
  }

  return { size: "", colorLabel: rest0.join("-") };
}

function fromCsvRow(row: CifraCsvRow): CifraRow {
  const name = stripHtml(row.Nombre).trim();
  const category = stripHtml(row.Categoría).trim() || FALLBACK_CATEGORY;
  const { size, colorLabel } = parseVariantSuffix(row.Modelo);
  return {
    slug: slugify(`${name}-${row.Modelo}`),
    model: row.Modelo,
    rootmodel: row["Modelo raíz"]?.trim() || row.Modelo,
    name,
    description: stripHtml(row.Descripción) || `${name}, personalizable con tu logo.`,
    category,
    subcategory: stripHtml(row.SubCategoría),
    image: row.Imagen,
    price: parseFloat(row.Precio) || 0,
    stock: parseInt(row.Stock, 10) || 0,
    material: stripHtml(row.Material),
    engravingTechnique: row["Técnica Grabación"]?.trim() ?? "",
    size,
    colorLabel,
  };
}

let cache: CifraRow[] | null = null;

function loadAllRows(): CifraRow[] {
  if (!cache) {
    const csvPath = path.join(process.cwd(), "data", "cifra-products.csv");
    const file = fs.readFileSync(csvPath, "utf-8");
    const { data } = Papa.parse<CifraCsvRow>(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    });
    cache = data.map(fromCsvRow).filter((p) => p.name && p.model);
  }
  return cache;
}

function groupKey(p: CifraRow) {
  return `${p.category}||${p.name}`;
}

// One representative (highest-stock) row per (category, name) family, plus
// every variant (including out-of-stock ones) that shares that family.
export function getCifraFamilies(): { representative: CifraRow; variants: CifraRow[] }[] {
  const rows = loadAllRows().filter((r) => r.stock > 0);
  const byKey = new Map<string, CifraRow[]>();
  for (const r of rows) {
    const key = groupKey(r);
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }

  return Array.from(byKey.entries()).map(([key, familyReps]) => {
    const representative = familyReps.slice().sort((a, b) => b.stock - a.stock)[0];
    const allVariants = loadAllRows().filter((r) => groupKey(r) === key);
    return { representative, variants: allVariants };
  });
}
