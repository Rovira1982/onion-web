// One-time import: reads the Roly/Stamina "Maestro de Artículos" Excel
// exports (via prisma/_extract-roly-xlsx.py -> prisma/_roly-{rol,sta}.json)
// and writes them into the database. Safe to re-run — everything is
// upserted by a stable key (supplier+SKU for products, supplierModelCode
// for variants), same pattern as prisma/import-cifra.ts.
//
// Roly = textile (top category "Ropa Laboral"); Stamina = general
// promotional gifts (top category "Regalo Promocional", like Cifra).
//
// These master files don't include live stock — every variant gets a
// fixed placeholder stock (STOCK_PLACEHOLDER) so products are visible on
// the site now; swap for real figures once Gorfactory's API is active.
//
// Run with: npx tsx prisma/import-roly.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MARGEN = 1.4; // BASE_COSTS.Multiplicador_rec de src/lib/pricing.ts
const STOCK_PLACEHOLDER = 500;

type RolRow = {
  PRODUCTCODE: string;
  MODELCODE: string;
  MODELNAME: string | null;
  DESCRIPTION: string | null;
  COMPOSITION: string | null;
  FAMILIE: string | null;
  SIZE: string | null;
  COLOR: string | null;
  PRODUCTIMAGE: string | null;
  MODELIMAGE: string | null;
  "PRICE UNIT": string | number | null;
};

type StaRow = {
  PRODUCTCODE: string;
  MODELCODE: string;
  MODELNAME: string | null;
  DESCRIPTION: string | null;
  COMPOSITION: string | null;
  FAMILIE: string | null;
  SIZE: string | null;
  COLOR: string | null;
  PRODUCTIMAGE: string | null;
  MODELIMAGE: string | null;
  "PRICE < 500 UNITS": string | number | null;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

async function importCatalog<T extends { PRODUCTCODE: string; MODELCODE: string; MODELNAME: string | null }>(opts: {
  supplierName: string;
  adapterKey: string;
  topCategory: string;
  rows: T[];
  netPriceOf: (row: T) => number;
  descriptionOf: (row: T) => string | null;
  compositionOf: (row: T) => string | null;
  familieOf: (row: T) => string | null;
  sizeOf: (row: T) => string | null;
  colorOf: (row: T) => string | null;
  imageOf: (row: T) => string | null;
}) {
  console.log(`\nImportando ${opts.supplierName} (${opts.rows.length} filas)...`);

  const supplier = await prisma.supplier.upsert({
    where: { name: opts.supplierName },
    update: {},
    create: { name: opts.supplierName, adapterKey: opts.adapterKey },
  });

  const topCategory = await prisma.category.upsert({
    where: { slug: slugify(opts.topCategory) },
    update: {},
    create: { name: opts.topCategory, slug: slugify(opts.topCategory) },
  });

  const childCategoryIds = new Map<string, string>();
  async function categoryIdFor(rawName: string): Promise<string> {
    const name = rawName.trim() || "Otros artículos";
    const cached = childCategoryIds.get(name);
    if (cached) return cached;
    const cat = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { parentId: topCategory.id },
      create: { name, slug: slugify(name), parentId: topCategory.id },
    });
    childCategoryIds.set(name, cat.id);
    return cat.id;
  }

  const byModel = new Map<string, T[]>();
  for (const row of opts.rows) {
    if (!row.PRODUCTCODE || !row.MODELCODE) continue;
    const list = byModel.get(row.MODELCODE) ?? [];
    list.push(row);
    byModel.set(row.MODELCODE, list);
  }

  let done = 0;
  let variantsWritten = 0;
  const models = [...byModel.entries()];

  for (const [modelCode, rows] of models) {
    const rep = rows[0];
    const netPrices = rows.map(opts.netPriceOf).filter((p) => p > 0);
    const cheapestNet = netPrices.length > 0 ? Math.min(...netPrices) : 0;
    const basePrice = Math.round(cheapestNet * MARGEN * 100) / 100;
    const categoryId = await categoryIdFor(opts.familieOf(rep) ?? "Otros artículos");
    const primaryImage = opts.imageOf(rep) ?? "";

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: modelCode } },
      update: {
        name: rep.MODELNAME || modelCode,
        description: opts.descriptionOf(rep) || "",
        material: opts.compositionOf(rep) || null,
        basePrice,
        stock: STOCK_PLACEHOLDER,
        categoryId,
        lastSyncedAt: new Date(),
      },
      create: {
        supplierId: supplier.id,
        supplierSku: modelCode,
        name: rep.MODELNAME || modelCode,
        description: opts.descriptionOf(rep) || "",
        material: opts.compositionOf(rep) || null,
        basePrice,
        stock: STOCK_PLACEHOLDER,
        categoryId,
      },
    });

    if (primaryImage) {
      const existingImage = await prisma.productImage.findFirst({ where: { productId: product.id, url: primaryImage } });
      if (!existingImage) {
        await prisma.productImage.create({ data: { productId: product.id, url: primaryImage, position: 0 } });
      }
    }

    for (const row of rows) {
      const net = opts.netPriceOf(row);
      const price = Math.round(net * MARGEN * 100) / 100;
      await prisma.productVariant.upsert({
        where: { supplierModelCode: row.PRODUCTCODE },
        update: {
          size: opts.sizeOf(row) || null,
          color: opts.colorOf(row) || null,
          price,
          stock: STOCK_PLACEHOLDER,
          productId: product.id,
        },
        create: {
          productId: product.id,
          size: opts.sizeOf(row) || null,
          color: opts.colorOf(row) || null,
          price,
          stock: STOCK_PLACEHOLDER,
          supplierModelCode: row.PRODUCTCODE,
        },
      });
      variantsWritten++;
    }

    done++;
    if (done % 100 === 0) {
      console.log(`  ${done}/${models.length} modelos (${variantsWritten} variantes)...`);
    }
  }

  console.log(`${opts.supplierName}: ${done} productos, ${variantsWritten} variantes.`);
}

async function main() {
  const rol = JSON.parse(fs.readFileSync("prisma/_roly-rol.json", "utf-8")) as RolRow[];
  const sta = JSON.parse(fs.readFileSync("prisma/_roly-sta.json", "utf-8")) as StaRow[];

  await importCatalog({
    supplierName: "Roly",
    adapterKey: "gorfactory",
    topCategory: "Ropa Laboral",
    rows: rol,
    netPriceOf: (r) => toNumber(r["PRICE UNIT"]),
    descriptionOf: (r) => r.DESCRIPTION,
    compositionOf: (r) => r.COMPOSITION,
    familieOf: (r) => r.FAMILIE,
    sizeOf: (r) => r.SIZE,
    colorOf: (r) => r.COLOR,
    imageOf: (r) => r.MODELIMAGE || r.PRODUCTIMAGE,
  });

  await importCatalog({
    supplierName: "Stamina",
    adapterKey: "gorfactory",
    topCategory: "Regalo Promocional",
    rows: sta,
    netPriceOf: (r) => toNumber(r["PRICE < 500 UNITS"]),
    descriptionOf: (r) => r.DESCRIPTION,
    compositionOf: (r) => r.COMPOSITION,
    familieOf: (r) => r.FAMILIE,
    sizeOf: (r) => r.SIZE,
    colorOf: (r) => r.COLOR,
    imageOf: (r) => r.MODELIMAGE || r.PRODUCTIMAGE,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
