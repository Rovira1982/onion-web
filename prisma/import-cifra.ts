// One-time import: reads data/cifra-products.csv (via prisma/cifra-source.ts)
// and writes it into the real database. Safe to re-run — everything is
// upserted by a stable key (supplier+SKU for products, supplierModelCode
// for variants).
//
// Run with: npx tsx prisma/import-cifra.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { getCifraFamilies } from "./cifra-source";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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

  const families = getCifraFamilies();
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

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku } },
      update: {
        name: rep.name,
        description: rep.description,
        subcategory: rep.subcategory || null,
        material: rep.material || null,
        engravingTechnique: rep.engravingTechnique || null,
        basePrice: rep.price,
        stock: totalStock,
        categoryId,
        lastSyncedAt: new Date(),
      },
      create: {
        supplierId: supplier.id,
        supplierSku,
        name: rep.name,
        description: rep.description,
        subcategory: rep.subcategory || null,
        material: rep.material || null,
        engravingTechnique: rep.engravingTechnique || null,
        basePrice: rep.price,
        stock: totalStock,
        categoryId,
      },
    });

    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id, url: rep.image },
    });
    if (!existingImage && rep.image) {
      await prisma.productImage.create({
        data: { productId: product.id, url: rep.image, position: 0 },
      });
    }

    for (const v of variants) {
      await prisma.productVariant.upsert({
        where: { supplierModelCode: v.model },
        update: {
          size: v.size || null,
          color: v.colorLabel || null,
          price: v.price,
          stock: v.stock,
          productId: product.id,
        },
        create: {
          productId: product.id,
          size: v.size || null,
          color: v.colorLabel || null,
          price: v.price,
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
