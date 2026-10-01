// Live import: pulls Roly/Stamina catalog + wholesale pricelist + real
// warehouse stock straight from the Gorfactory API (src/lib/gorfactory.ts)
// and writes them into the database. Safe to re-run — everything is
// upserted by a stable key (supplier+SKU for products, supplierModelCode
// for variants), same pattern as prisma/import-cifra.ts.
//
// Roly = textile (top category "Ropa Laboral"); Stamina = general
// promotional gifts (top category "Regalo Promocional", like Cifra).
//
// Replaces the earlier one-time Excel import (_roly-{rol,sta}.json, no
// longer generated): the Gorfactory API is confirmed live as of 2026-09-29,
// with real per-SKU price (getPricelist) and stock (getUserStock, warehouse
// "01" — the only warehouse code that has worked so far).
//
// Run with: npx tsx prisma/import-roly.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MARGEN = 2; // Gorfactory es precio de mayorista: ×2 sobre coste (el ×1.4 de pricing.ts se queda corto en prenda lisa/regalo)
const WAREHOUSE = "01"; // único código de almacén confirmado en pruebas en vivo

// Inline API client (not importing src/lib/gorfactory.ts, which is guarded
// with "server-only" and can't be loaded by a plain tsx script) — same
// pattern as prisma/import-toptex.ts's own inline TopTex client.
const GF_BASE_URL = process.env.GORFACTORY_BASE_URL ?? "https://clientsws.gorfactory.es:2096";
let gfToken: string | null = null;

async function gfLogin(): Promise<string> {
  const form = new FormData();
  form.set("username", process.env.GORFACTORY_USERNAME!);
  form.set("password", process.env.GORFACTORY_PASSWORD!);
  const res = await fetch(`${GF_BASE_URL}/api/v1/login`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Gorfactory login falló: ${res.status} ${await res.text()}`);
  const { token } = JSON.parse(await res.text()) as { token: string };
  return token;
}

async function gfGet(path: string) {
  if (!gfToken) gfToken = await gfLogin();
  const res = await fetch(`${GF_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${gfToken}` } });
  if (!res.ok) throw new Error(`GET ${path} falló: ${res.status} ${await res.text()}`);
  return res.json();
}

async function gfPost(path: string, form: FormData) {
  if (!gfToken) gfToken = await gfLogin();
  const res = await fetch(`${GF_BASE_URL}${path}`, { method: "POST", body: form, headers: { Authorization: `Bearer ${gfToken}` } });
  if (!res.ok) throw new Error(`POST ${path} falló: ${res.status} ${await res.text()}`);
  return res.json();
}

type GorfactoryCatalogItem = {
  itemcode: string;
  modelcode: string;
  modelname: string;
  description: string;
  composition: string;
  family: string;
  sizename: string;
  colorname: string;
  productimage: string;
  modelimage: string;
};

function getCatalog(params: { brand: string }) {
  return gfGet(`/api/v1/item/getcatalog?lang=es-ES&brand=${params.brand}`) as Promise<{ item: GorfactoryCatalogItem[] }>;
}

function getPricelist(params: { brand: string }) {
  const form = new FormData();
  form.set("brand", params.brand);
  form.set("includeoutlet", "0");
  return gfPost(`/api/v1/item/pricelist`, form) as Promise<{
    pricelist: { productcode: string; type: string; price_unit: number | null; price_1: number | null }[];
  }>;
}

// Roly's pricelist returns type "fixed" with price_unit populated. Stamina's
// returns type "range" instead — price_unit is empty and the real price
// lives in price_1..4 (quantity tiers, limit_1..3). price_1 is the <500-unit
// tier — closest equivalent to a single "unit" price until the business
// decides how the web should pick a tier (pending, see maestro de precios).
function resolvePrice(p: { type: string; price_unit: number | null; price_1: number | null }): number {
  if (p.type === "range") return Number(p.price_1) || 0;
  return Number(p.price_unit) || 0;
}

function getUserStock(params: { brand: string; whscode: string }) {
  const form = new FormData();
  form.set("brand", params.brand);
  form.set("whscode", params.whscode);
  return gfPost(`/api/v1/stock/getuserstock`, form) as Promise<{ stock: { sku: string; onhand: string }[] | null }>;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function importBrand(opts: { brand: string; supplierName: string; topCategory: string }) {
  console.log(`\nDescargando ${opts.supplierName} desde la API de Gorfactory...`);

  const [catalogRes, priceRes, stockRes] = await Promise.all([
    getCatalog({ brand: opts.brand }),
    getPricelist({ brand: opts.brand }),
    getUserStock({ brand: opts.brand, whscode: WAREHOUSE }),
  ]);

  const priceBySku = new Map(priceRes.pricelist.map((p) => [p.productcode, resolvePrice(p)]));
  const stockBySku = new Map((stockRes.stock ?? []).map((s) => [s.sku, Number(s.onhand) || 0]));

  console.log(
    `${opts.supplierName}: ${catalogRes.item.length} filas de catálogo, ${priceBySku.size} precios, ${stockBySku.size} stocks.`
  );

  const supplier = await prisma.supplier.upsert({
    where: { name: opts.supplierName },
    update: {},
    create: { name: opts.supplierName, adapterKey: "gorfactory" },
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

  const byModel = new Map<string, GorfactoryCatalogItem[]>();
  for (const row of catalogRes.item) {
    if (!row.itemcode || !row.modelcode) continue;
    const list = byModel.get(row.modelcode) ?? [];
    list.push(row);
    byModel.set(row.modelcode, list);
  }

  let done = 0;
  let variantsWritten = 0;
  const models = [...byModel.entries()];

  for (const [modelCode, rows] of models) {
    const rep = rows[0];
    const netPrices = rows.map((r) => priceBySku.get(r.itemcode) ?? 0).filter((p) => p > 0);
    const cheapestNet = netPrices.length > 0 ? Math.min(...netPrices) : 0;
    const basePrice = Math.round(cheapestNet * MARGEN * 100) / 100;
    const totalStock = rows.reduce((sum, r) => sum + (stockBySku.get(r.itemcode) ?? 0), 0);
    const categoryId = await categoryIdFor(rep.family ?? "Otros artículos");
    const primaryImage = rep.modelimage || rep.productimage || "";

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: modelCode } },
      update: {
        name: rep.modelname || modelCode,
        description: rep.description || "",
        brand: opts.supplierName,
        material: rep.composition || null,
        basePrice,
        stock: totalStock,
        categoryId,
        lastSyncedAt: new Date(),
      },
      create: {
        supplierId: supplier.id,
        supplierSku: modelCode,
        name: rep.modelname || modelCode,
        description: rep.description || "",
        brand: opts.supplierName,
        material: rep.composition || null,
        basePrice,
        stock: totalStock,
        categoryId,
      },
    });

    if (primaryImage) {
      const existingImage = await prisma.productImage.findFirst({ where: { productId: product.id, url: primaryImage } });
      if (!existingImage) {
        await prisma.productImage.create({ data: { productId: product.id, url: primaryImage, position: 0 } });
      }
    }

    // Una foto por color (petición del dueño, 2026-10-01: al pulsar un
    // color en la ficha, la foto debe cambiar) — Gorfactory sí da un
    // productimage distinto por fila de color/talla, antes se descartaba
    // quedándose solo con el de la fila representativa.
    const imageByColor = new Map<string, string>();
    for (const row of rows) {
      const color = row.colorname?.trim();
      const image = row.productimage || row.modelimage;
      if (color && image && !imageByColor.has(color)) imageByColor.set(color, image);
    }
    let colorImagePosition = 1;
    for (const [color, url] of imageByColor) {
      if (url === primaryImage) continue; // ya guardada arriba como genérica
      // id determinista -> upsert en una sola consulta en vez de
      // findFirst+create (2 consultas por color multiplicaban mucho el
      // tiempo total contra la base de datos remota — visto en directo:
      // esta misma ejecución tardó horas por esto).
      const id = `${opts.supplierName.toLowerCase()}-${modelCode}-${color}`;
      await prisma.productImage.upsert({
        where: { id },
        update: { url, color },
        create: { id, productId: product.id, url, position: colorImagePosition, color },
      });
      colorImagePosition++;
    }

    for (const row of rows) {
      const net = priceBySku.get(row.itemcode) ?? 0;
      const price = Math.round(net * MARGEN * 100) / 100;
      const stock = stockBySku.get(row.itemcode) ?? 0;
      await prisma.productVariant.upsert({
        where: { supplierModelCode: row.itemcode },
        update: {
          size: row.sizename || null,
          color: row.colorname || null,
          price,
          stock,
          productId: product.id,
        },
        create: {
          productId: product.id,
          size: row.sizename || null,
          color: row.colorname || null,
          price,
          stock,
          supplierModelCode: row.itemcode,
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
  // Optional CLI filter — `npx tsx prisma/import-roly.ts stamina` runs only
  // that brand, useful to avoid burning extra API calls against Gorfactory's
  // daily rate limit when re-running just one brand (e.g. after a 429).
  const only = process.argv[2]?.toLowerCase();
  if (!only || only === "roly") {
    await importBrand({ brand: "roly", supplierName: "Roly", topCategory: "Ropa Laboral" });
  }
  if (!only || only === "stamina") {
    await importBrand({ brand: "stamina", supplierName: "Stamina", topCategory: "Regalo Promocional" });
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
