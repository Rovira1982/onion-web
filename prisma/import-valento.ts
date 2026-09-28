// One-time import: pulls a batch of the Valento catalog feed (single JSON
// call, paginated) and writes it into the database. Safe to re-run —
// everything is upserted by a stable key (supplier+SKU for products,
// supplierModelCode for variants), same pattern as prisma/import-cifra.ts
// and prisma/import-toptex.ts.
//
// Run with: npx tsx prisma/import-valento.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE_URL = process.env.VALENTO_BASE_URL ?? "https://www.valento.es/rest";
const PAGE_SIZE = 50;
const PAGE_LIMIT = 20; // catálogo completo (917 productos ÷ 50/página = 19 páginas)
const MARGEN = 1.4; // BASE_COSTS.Multiplicador_rec de src/lib/pricing.ts — mismo margen "recomendado" del presupuestador Excel

const TOP_CATEGORY = "Ropa Laboral"; // mismo bucket que TopTex — ver import-cifra.ts

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Importando catálogo de Valento a la base de datos...\n");

  const supplier = await prisma.supplier.upsert({
    where: { name: "Valento" },
    update: {},
    create: { name: "Valento", adapterKey: "valento" },
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
    const q = new URLSearchParams({
      key: process.env.VALENTO_KEY!,
      idioma: "es",
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    const res = await fetch(`${BASE_URL}/catalog_feed.php?${q}`);
    if (!res.ok) throw new Error(`Valento catalog_feed falló: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;

    for (const p of data.products) {
      const categoryId = await categoryIdFor(p.category_path?.[0] ?? "Otros artículos");
      const cheapestNet = Math.min(...p.variants.map((v: { net_price: number }) => v.net_price));
      const basePrice = Number.isFinite(cheapestNet) ? Math.round(cheapestNet * MARGEN * 100) / 100 : 0;
      const totalStock = p.variants.reduce((sum: number, v: { stock: number }) => sum + v.stock, 0);
      const primaryImage = p.variants[0]?.image_web || p.variants[0]?.image || p.images_web?.[0] || p.images?.[0] || "";

      const product = await prisma.product.upsert({
        where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: p.article_ref } },
        update: {
          name: p.name,
          description: p.description,
          brand: p.brand || null,
          material: p.characteristics?.composicion || null,
          basePrice,
          stock: totalStock,
          categoryId,
          lastSyncedAt: new Date(),
        },
        create: {
          supplierId: supplier.id,
          supplierSku: p.article_ref,
          name: p.name,
          description: p.description,
          brand: p.brand || null,
          material: p.characteristics?.composicion || null,
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

      for (const v of p.variants) {
        const price = Math.round(v.net_price * MARGEN * 100) / 100;
        await prisma.productVariant.upsert({
          where: { supplierModelCode: v.cref },
          update: { size: v.size || null, color: v.color || null, price, stock: v.stock, productId: product.id },
          create: {
            productId: product.id,
            size: v.size || null,
            color: v.color || null,
            price,
            stock: v.stock,
            supplierModelCode: v.cref,
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
