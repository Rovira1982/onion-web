// One-time import: pulls a batch of the TopTex catalog (catalog + price +
// inventory, 3 live API calls) and writes it into the database. Safe to
// re-run — everything is upserted by a stable key (supplier+SKU for
// products, supplierModelCode for variants), same pattern as
// prisma/import-cifra.ts.
//
// Deliberately pulls only PAGE_LIMIT pages on each run (not the whole
// multi-thousand-SKU catalog) — bump PAGE_LIMIT and re-run to expand.
//
// Run with: npx tsx prisma/import-toptex.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE_URL = process.env.TOPTEX_BASE_URL ?? "https://api.toptex.io";
const PAGE_SIZE = 20;
const PAGE_LIMIT = 3; // first ~60 products — re-run with a higher value to expand
const MARGEN = 1.4; // BASE_COSTS.Multiplicador_rec de src/lib/pricing.ts — mismo margen "recomendado" del presupuestador Excel

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
async function getToken(): Promise<string> {
  if (token) return token;
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

async function toptexGet(path: string) {
  const t = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": process.env.TOPTEX_API_KEY!, "x-toptex-authorization": t },
  });
  if (!res.ok) throw new Error(`GET ${path} falló: ${res.status} ${await res.text()}`);
  return res.json();
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
type ToptexInventoryItem = { sku: string; totalStock?: number; stock?: { warehouseStock?: number }[] };

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

  let done = 0;
  let variantsWritten = 0;

  for (let page = 1; page <= PAGE_LIMIT; page++) {
    console.log(`Página ${page}/${PAGE_LIMIT}...`);
    const catalogRes = (await toptexGet(
      `/v3/products/all?usage_right=b2b_uniquement&page_number=${page}&page_size=${PAGE_SIZE}`
    )) as { items: ToptexProduct[] };
    if (!catalogRes.items || catalogRes.items.length === 0) break;

    for (const item of catalogRes.items) {
      const [priceRes, inventoryRes] = await Promise.all([
        toptexGet(`/v3/products/price?catalog_reference=${encodeURIComponent(item.catalogReference)}`) as Promise<{
          items: ToptexPrice[];
        }>,
        toptexGet(`/v3/products/inventory?catalog_reference=${encodeURIComponent(item.catalogReference)}`) as Promise<{
          items: ToptexInventoryItem[];
        }>,
      ]);
      const priceBySku = new Map(priceRes.items?.map((p) => [p.sku, p.prices?.[0]?.price ?? 0]) ?? []);
      const stockBySku = new Map(
        inventoryRes.items?.map((i) => [i.sku, i.totalStock ?? i.stock?.reduce((s, w) => s + (w.warehouseStock ?? 0), 0) ?? 0]) ?? []
      );

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
  }

  console.log(`\nImportación completa: ${done} productos, ${variantsWritten} variantes.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
