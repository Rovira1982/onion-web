// Live import: pulls Cifra's confidential (cost) pricelist from their API
// (via prisma/cifra-source.ts) and writes it into the database. Safe to
// re-run — everything is upserted by a stable key (supplier+SKU for
// products, supplierModelCode for variants).
//
// Replaces the earlier one-time CSV import — confirmed live 2026-09-29,
// api.cifrashop.com/tariff/:TOKEN gives 6138 products with real cost/stock.
//
// Run with: npx tsx prisma/import-cifra.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { getCifraFamilies } from "./cifra-source";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// confidential_price is Cifra's wholesale cost — their own PVP endpoint is
// confirmed live to always be exactly confidential_price × 2 (checked across
// all 6138 products), matching the ×2 margin we already use for Roly/Stamina.
const MARGEN = 2;
const DEFAULT_CATEGORY = "Regalo Promocional";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Importando catálogo de Cifra a la base de datos...\n");

  const supplier = await prisma.supplier.upsert({
    where: { name: "Cifra" },
    update: {},
    create: { name: "Cifra", adapterKey: "cifra" },
  });

  // Seed the 3 top-level buckets now (Ropa Laboral / Ropa Deportiva stay
  // empty until Roly/TopTex/Gorfactory/Joma are connected). Cifra's own 32
  // categories (Llaveros, Escritura, Bolsas...) become children of "Regalo
  // Promocional" — this is what the live site's category browsing actually
  // uses; dumping everything into the parent bucket alone (as an earlier
  // version of this script did) loses that navigation entirely.
  const topCategoryIds: Record<string, string> = {};
  for (const name of ["Regalo Promocional", "Ropa Laboral", "Ropa Deportiva"]) {
    const cat = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    topCategoryIds[name] = cat.id;
  }

  const families = await getCifraFamilies();
  console.log(`${families.length} familias de producto a importar...\n`);

  const childCategoryIds = new Map<string, string>();
  async function categoryIdFor(rawName: string): Promise<string> {
    const name = rawName.trim() || "Otros artículos";
    const cached = childCategoryIds.get(name);
    if (cached) return cached;
    const cat = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { parentId: topCategoryIds["Regalo Promocional"] },
      create: { name, slug: slugify(name), parentId: topCategoryIds["Regalo Promocional"] },
    });
    childCategoryIds.set(name, cat.id);
    return cat.id;
  }

  // Cifra's "Modelo raíz" is not always unique per real product: 209 root
  // codes in the current catalog are shared by families with different
  // (category, name) — e.g. "MACETA TERRACOTA COSMOS/GIRASOL/LUPINE" all
  // share rootmodel 10200. Grouping already happens by (category, name), so
  // here we only need to make the DB key unique per family: append a suffix
  // whenever the same rootmodel repeats.
  const skuSeen = new Map<string, number>();
  function uniqueSkuFor(rootmodel: string) {
    const count = skuSeen.get(rootmodel) ?? 0;
    skuSeen.set(rootmodel, count + 1);
    return count === 0 ? rootmodel : `${rootmodel}-${count + 1}`;
  }

  let done = 0;
  let variantsWritten = 0;

  for (const { representative: rep, variants } of families) {
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const supplierSku = uniqueSkuFor(rep.rootmodel);
    const categoryId = await categoryIdFor(rep.category);
    const basePrice = Math.round(rep.price * MARGEN * 100) / 100;

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku } },
      update: {
        name: rep.name,
        description: rep.description,
        brand: "Cifra",
        subcategory: rep.subcategory || null,
        material: rep.material || null,
        engravingTechnique: rep.engravingTechnique || null,
        basePrice,
        stock: totalStock,
        categoryId,
        lastSyncedAt: new Date(),
      },
      create: {
        supplierId: supplier.id,
        supplierSku,
        name: rep.name,
        description: rep.description,
        brand: "Cifra",
        subcategory: rep.subcategory || null,
        material: rep.material || null,
        engravingTechnique: rep.engravingTechnique || null,
        basePrice,
        stock: totalStock,
        categoryId,
      },
    });

    const images = [rep.image, ...rep.images].filter((url, i, arr) => url && arr.indexOf(url) === i);
    for (const [i, url] of images.entries()) {
      const existingImage = await prisma.productImage.findFirst({ where: { productId: product.id, url } });
      if (!existingImage) {
        await prisma.productImage.create({ data: { productId: product.id, url, position: i } });
      }
    }

    // Una foto por color (petición del dueño, 2026-10-01, misma idea que
    // Roly) — cada variante de Cifra ya trae su propia imagen en el feed
    // (item.images), antes se descartaba quedándose solo con la de la fila
    // representativa.
    const imageByColor = new Map<string, string>();
    for (const v of variants) {
      const color = v.colorLabel?.trim();
      const url = v.image || v.images[0];
      if (color && url && !imageByColor.has(color)) imageByColor.set(color, url);
    }
    let colorImagePosition = images.length;
    for (const [color, url] of imageByColor) {
      if (images.includes(url)) continue; // ya guardada arriba como genérica
      const existingColorImage = await prisma.productImage.findFirst({ where: { productId: product.id, url } });
      if (!existingColorImage) {
        await prisma.productImage.create({ data: { productId: product.id, url, position: colorImagePosition, color } });
      }
      colorImagePosition++;
    }

    for (const v of variants) {
      const price = Math.round(v.price * MARGEN * 100) / 100;
      await prisma.productVariant.upsert({
        where: { supplierModelCode: v.model },
        update: {
          size: v.size || null,
          color: v.colorLabel || null,
          price,
          stock: v.stock,
          productId: product.id,
        },
        create: {
          productId: product.id,
          size: v.size || null,
          color: v.colorLabel || null,
          price,
          stock: v.stock,
          supplierModelCode: v.model,
        },
      });
      variantsWritten++;
    }

    done++;
    if (done % 200 === 0) {
      console.log(`  ${done}/${families.length} familias (${variantsWritten} variantes)...`);
    }
  }

  console.log(`\nImportación completa: ${done} productos, ${variantsWritten} variantes.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
