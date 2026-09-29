// Import: pulls the full TopTex catalog (catalog + price + inventory) and
// writes it into the database. Safe to re-run — everything is upserted by a
// stable key (supplier+SKU for products, supplierModelCode for variants),
// same pattern as prisma/import-cifra.ts.
//
// Paginates until the API reports no more pages (total_count from the first
// response) — confirmed live 2026-09-29: 2986 products under b2b_uniquement.
//
// Run with: npx tsx prisma/import-toptex.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

// Cache for the bulk price/inventory download (~300 requests, several
// minutes) — the process has died mid-catalog-loop a couple of times on
// this machine for reasons unrelated to the API (no error logged), so a
// retry re-fetching pricing from scratch each time wastes minutes before
// even reaching the point it died at last time. Cached outside the repo
// (scratchpad), deleted once the import finishes cleanly.
const CACHE_DIR =
  "C:\\Users\\USUARIO\\AppData\\Local\\Temp\\claude\\E--onion-26-web\\460ff51e-804d-484e-bb44-9a6fa7f16a05\\scratchpad";
const PRICE_CACHE = `${CACHE_DIR}/toptex-prices-cache.json`;
const INVENTORY_CACHE = `${CACHE_DIR}/toptex-inventory-cache.json`;
// Last catalog page fully written to the DB — a retry resumes from the next
// one instead of re-fetching/re-upserting everything from page 1 (upserts
// are idempotent so that was never wrong, just slow against a flaky API).
const PAGE_CHECKPOINT = `${CACHE_DIR}/toptex-page-checkpoint.json`;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE_URL = process.env.TOPTEX_BASE_URL ?? "https://api.toptex.io";
// Confirmed live: page_size 100 on the catalog endpoint can exceed the API
// gateway's 6MB response cap on image/description-heavy pages (200 was fine
// on a light page earlier, but not reliably) — 25 stays safely under it.
const PAGE_SIZE = 25;
// ×2 sobre el coste de mayorista — mismo criterio que Roly/Stamina/Cifra.
// TopTex's own site shows public prices at almost exactly cost × 2 too
// (verified live 2026-09-29 on IB300: 1.93€ coste vs 3.86€ en toptex.es).
const MARGEN = 2;

const TOP_CATEGORY = "Ropa Laboral"; // ver comentario en import-cifra.ts: bucket previsto para TopTex

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

let token: string | null = null;
async function getToken(forceRefresh = false): Promise<string> {
  if (token && !forceRefresh) return token;
  const res = await fetch(`${BASE_URL}/v3/authenticate`, {
    method: "POST",
    headers: { "x-api-key": process.env.TOPTEX_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.TOPTEX_USERNAME, password: process.env.TOPTEX_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login TopTex falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  token = data.token;
  return token;
}

// The token has a TTL shorter than this script's total runtime (a full
// import can take several minutes across catalog + bulk price/inventory) —
// confirmed live: a 401 "incoming token has expired" mid-run. Re-login once
// and retry on 401, same pattern as src/lib/toptex.ts's toptexFetch.
async function toptexGet(path: string, isRetry = false): Promise<any> {
  const t = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": process.env.TOPTEX_API_KEY!, "x-toptex-authorization": t },
  });
  if (res.status === 401 && !isRetry) {
    await getToken(true);
    return toptexGet(path, true);
  }
  if (!res.ok) throw new Error(`GET ${path} falló: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // TopTex returns HTTP 200 with an error envelope (no `items`) when a page
  // is too heavy for its gateway — confirmed live: "Response payload size
  // exceeded maximum allowed payload size (6291556 bytes)". Silently reading
  // `.items` as undefined would look like "no more pages" and truncate the
  // import, so fail loudly instead.
  if (json && typeof json === "object" && "errorType" in json) {
    throw new Error(`GET ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

type Localized = Record<string, string>;
type ToptexSize = {
  sku: string;
  sizeCode: string;
  colorCode: string;
  size: string;
};
type ToptexColor = {
  colors: Localized;
  packshots?: Record<string, { url_packshot: string }>;
  sizes: ToptexSize[];
};
type ToptexProduct = {
  catalogReference: string;
  designation: Localized;
  description: Localized;
  family: Localized;
  sub_family?: Localized;
  composition?: Localized;
  brand?: string;
  images: { url_image: string }[];
  colors: ToptexColor[];
};
type ToptexPriceTier = { quantity: string; price: number };
type ToptexPrice = { sku: string; prices: ToptexPriceTier[] };
// Confirmed live shape: one row per warehouse (toptex + manufacturer-N), each
// with its own `stock` number — sum them for total available stock.
type ToptexInventoryItem = { sku: string; warehouses?: { id: string; stock: number }[] };

const BULK_PAGE_SIZE = 500; // price/inventory rows are lightweight, but 2000 hit a 504 mid-pagination — 500 is safer

async function toptexGetWithRetry(path: string, attempts = 3): Promise<any> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await toptexGet(path);
    } catch (err) {
      const retryable =
        err instanceof Error && (err.message.includes("504") || err.message.includes("ResponseSizeTooLarge"));
      if (!retryable || i === attempts) throw err;
      console.log(`  (fallo transitorio en intento ${i}/${attempts}, reintentando: ${path})`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function fetchAllPages<T>(pathBase: string, itemsKey = "items"): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = Infinity;
  while (page <= totalPages) {
    const res = (await toptexGetWithRetry(`${pathBase}&page_number=${page}&page_size=${BULK_PAGE_SIZE}`)) as {
      [key: string]: unknown;
      total_count?: number;
    };
    const items = (res[itemsKey] as T[]) ?? [];
    if (items.length === 0) break;
    all.push(...items);
    if (page === 1 && typeof res.total_count === "number") {
      totalPages = Math.ceil(res.total_count / BULK_PAGE_SIZE);
    }
    console.log(`  ${pathBase} página ${page}/${Number.isFinite(totalPages) ? totalPages : "?"} (${all.length} filas)...`);
    page++;
  }
  return all;
}

async function main() {
  console.log("Importando catálogo de TopTex a la base de datos...\n");

  const supplier = await prisma.supplier.upsert({
    where: { name: "TopTex" },
    update: {},
    create: { name: "TopTex", adapterKey: "toptex" },
  });

  const topCategory = await prisma.category.upsert({
    where: { slug: slugify(TOP_CATEGORY) },
    update: {},
    create: { name: TOP_CATEGORY, slug: slugify(TOP_CATEGORY) },
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

  let allPrices: ToptexPrice[];
  let allInventory: ToptexInventoryItem[];
  if (fs.existsSync(PRICE_CACHE) && fs.existsSync(INVENTORY_CACHE)) {
    console.log("Usando precio/inventario en caché de un intento anterior...");
    allPrices = JSON.parse(fs.readFileSync(PRICE_CACHE, "utf-8"));
    allInventory = JSON.parse(fs.readFileSync(INVENTORY_CACHE, "utf-8"));
  } else {
    console.log("Descargando precios e inventario completos (paginados)...");
    [allPrices, allInventory] = await Promise.all([
      fetchAllPages<ToptexPrice>(`/v3/products/price?`),
      fetchAllPages<ToptexInventoryItem>(`/v3/products/inventory?`),
    ]);
    fs.writeFileSync(PRICE_CACHE, JSON.stringify(allPrices));
    fs.writeFileSync(INVENTORY_CACHE, JSON.stringify(allInventory));
  }
  // TopTex returns price as a string (e.g. "4.60") — Number() it here so
  // Number.isFinite below doesn't reject every entry and zero out basePrice.
  const priceBySku = new Map(allPrices.map((p) => [p.sku, Number(p.prices?.[0]?.price) || 0]));
  const stockBySku = new Map(
    allInventory.map((i) => [i.sku, i.warehouses?.reduce((s, w) => s + (Number(w.stock) || 0), 0) ?? 0])
  );
  console.log(`Precios: ${priceBySku.size} SKUs. Inventario: ${stockBySku.size} SKUs.\n`);

  let done = 0;
  let variantsWritten = 0;
  let pageLimit = Infinity;
  let startPage = 1;

  if (fs.existsSync(PAGE_CHECKPOINT)) {
    const checkpoint = JSON.parse(fs.readFileSync(PAGE_CHECKPOINT, "utf-8")) as {
      lastCompletedPage: number;
      pageLimit: number;
    };
    startPage = checkpoint.lastCompletedPage + 1;
    pageLimit = checkpoint.pageLimit;
    console.log(`Reanudando desde la página ${startPage}/${pageLimit} (checkpoint de un intento anterior).`);
  }

  const skippedPages: number[] = [];
  // TOPTEX_ONLY_PAGES=66,90 — retry just those pages (e.g. ones skipped in a
  // previous run) instead of sweeping the whole catalog again. Overrides the
  // checkpoint and bounds the loop to the requested pages so it doesn't spin
  // past them (pageLimit/total_count is otherwise only known after page 1).
  const onlyPages = process.env.TOPTEX_ONLY_PAGES
    ? new Set(process.env.TOPTEX_ONLY_PAGES.split(",").map((p) => parseInt(p.trim(), 10)))
    : null;
  if (onlyPages) {
    startPage = Math.min(...onlyPages);
    pageLimit = Math.max(...onlyPages);
    console.log(`Reintentando solo páginas: ${[...onlyPages].join(", ")}`);
  }

  for (let page = startPage; page <= pageLimit; page++) {
    if (onlyPages && !onlyPages.has(page)) continue;
    let catalogRes: { items: ToptexProduct[]; total_count?: number };
    try {
      catalogRes = (await toptexGetWithRetry(
        `/v3/products/all?usage_right=b2b_uniquement&page_number=${page}&page_size=${PAGE_SIZE}`
      )) as { items: ToptexProduct[]; total_count?: number };
    } catch (err) {
      // A page that fails all 3 retries (confirmed live: page 66 timed out
      // identically 3 runs in a row — a specific heavy product, not random
      // flakiness) would otherwise abort the whole import. Skip it instead
      // and keep going — better to land 119/120 pages than 0.
      console.log(`  ⚠ Página ${page} falló tras reintentos, la salto: ${(err as Error).message.slice(0, 150)}`);
      skippedPages.push(page);
      fs.writeFileSync(PAGE_CHECKPOINT, JSON.stringify({ lastCompletedPage: page, pageLimit }));
      continue;
    }
    if (page === 1 && typeof catalogRes.total_count === "number") {
      pageLimit = Math.ceil(catalogRes.total_count / PAGE_SIZE);
      console.log(`Catálogo total: ${catalogRes.total_count} productos, ${pageLimit} páginas.`);
    }
    console.log(`Página ${page}/${Number.isFinite(pageLimit) ? pageLimit : "?"}...`);
    if (!catalogRes.items || catalogRes.items.length === 0) break;

    for (const item of catalogRes.items) {
      const allSizes = item.colors.flatMap((c) => c.sizes.map((s) => ({ ...s, colorLabel: c.colors.es })));
      const totalStock = allSizes.reduce((sum, s) => sum + (stockBySku.get(s.sku) ?? 0), 0);
      const cheapestNet = Math.min(...allSizes.map((s) => priceBySku.get(s.sku) ?? Infinity).filter((p) => Number.isFinite(p)));
      const basePrice = Number.isFinite(cheapestNet) ? Math.round(cheapestNet * MARGEN * 100) / 100 : 0;

      const categoryId = await categoryIdFor(item.family?.es ?? "Otros artículos");
      const primaryImage =
        item.colors[0]?.packshots?.["FACE SIDE"]?.url_packshot ?? item.images?.[0]?.url_image ?? "";

      const product = await prisma.product.upsert({
        where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: item.catalogReference } },
        update: {
          name: item.designation?.es ?? item.catalogReference,
          description: item.description?.es ?? "",
          brand: item.brand || null,
          subcategory: item.sub_family?.es || null,
          material: item.composition?.es || null,
          basePrice,
          stock: totalStock,
          categoryId,
          lastSyncedAt: new Date(),
        },
        create: {
          supplierId: supplier.id,
          supplierSku: item.catalogReference,
          name: item.designation?.es ?? item.catalogReference,
          description: item.description?.es ?? "",
          brand: item.brand || null,
          subcategory: item.sub_family?.es || null,
          material: item.composition?.es || null,
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

      for (const s of allSizes) {
        const net = priceBySku.get(s.sku) ?? 0;
        const price = Math.round(net * MARGEN * 100) / 100;
        await prisma.productVariant.upsert({
          where: { supplierModelCode: s.sku },
          update: { size: s.size || null, color: s.colorLabel || null, price, stock: stockBySku.get(s.sku) ?? 0, productId: product.id },
          create: {
            productId: product.id,
            size: s.size || null,
            color: s.colorLabel || null,
            price,
            stock: stockBySku.get(s.sku) ?? 0,
            supplierModelCode: s.sku,
          },
        });
        variantsWritten++;
      }

      done++;
    }

    fs.writeFileSync(PAGE_CHECKPOINT, JSON.stringify({ lastCompletedPage: page, pageLimit }));
  }

  console.log(`\nImportación completa: ${done} productos, ${variantsWritten} variantes.`);
  if (skippedPages.length > 0) {
    console.log(`⚠ ${skippedPages.length} página(s) saltada(s) por fallo persistente: ${skippedPages.join(", ")}`);
    console.log(`  Esos productos no se importaron. Re-lanza con TOPTEX_ONLY_PAGES="${skippedPages.join(",")}" para reintentarlas sueltas.`);
  }
  for (const f of [PRICE_CACHE, INVENTORY_CACHE, PAGE_CHECKPOINT]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
