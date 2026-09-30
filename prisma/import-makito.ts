// Import de Makito (apis.makito.es) — API B2B REST con auth JWT. Ver
// https://data.makito.es/apis_b2b/index.html para la referencia completa.
//
// A diferencia de Roly/TopTex/Valento, las imágenes de Makito exigen el
// mismo Bearer token que el resto de la API (confirmado: 401 sin token) —
// no se pueden enlazar directo en <img src>, así que se descargan aquí y
// se re-suben a nuestro R2 (mismo bucket que los logos de clientes, con
// prefijo "makito/" para no chocar con ellos), servidas después a través
// de /api/uploads/[...key].
//
// --limit=N restringe la importación a los primeros N productos del
// catálogo (para probar antes de lanzar los ~4600 completos). Sin --limit,
// importa todo.
//
// Run with: npx tsx prisma/import-makito.ts [--limit=25] [--env=test|prod]
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BASE_URL = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const envArg = process.argv.find((a) => a.startsWith("--env="));
  return {
    limit: limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined,
    env: (envArg?.split("=")[1] as "test" | "prod") ?? "test",
  };
}

async function login(env: "test" | "prod"): Promise<string> {
  const clientId = env === "test" ? process.env.MAKITO_TEST_CLIENT_ID : process.env.MAKITO_CLIENT_ID;
  const clientSecret = env === "test" ? process.env.MAKITO_TEST_CLIENT_SECRET : process.env.MAKITO_CLIENT_SECRET;
  const res = await fetch(`${BASE_URL}/access/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

type MakitoVariant = {
  variant_reference: string;
  variant_image?: string;
  variant_thumbnail?: string;
  variant_name?: string;
  variant_colorcode?: string;
  variant_size?: string;
};

type MakitoProduct = {
  ref: string;
  web_reference: string;
  name: string;
  description?: string;
  material?: string | null;
  printcode?: string;
  categories?: string[];
  image?: string;
  thumbnail_image?: string;
  variants?: MakitoVariant[];
};

type MakitoStockRow = { material: string; quantity: number };
type MakitoPriceRow = { material: string; currency: string; baseQuantity: string; scales: { quantity: string; amount: string }[] };

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Código real de Makito para stock y pedidos: ref del producto + código de
// color + talla (ej. "15246"+"003"+"000" -> "15246003000"), confirmado
// contra /stock/files en directo, 2026-09-30 — NO es variant_reference
// (ese es un código de cara al cliente tipo "5246ROJS/T" que no aparece ni
// en stock ni en el formato que espera POST /orders, ver docs). Fallback a
// variant_reference solo para el caso sintético (producto sin variantes).
function makitoMaterialCode(productRef: string, v: MakitoVariant): string {
  if (v.variant_colorcode != null && v.variant_size != null) {
    return `${productRef}${v.variant_colorcode}${v.variant_size}`;
  }
  return v.variant_reference;
}

// Toma la última parte con sentido de "categories" (ruta tipo breadcrumb
// "Produccion > PRODUCTOS > Tecnología y accesorios > Otros > Camaras") —
// evitamos los niveles genéricos "Produccion"/"PRODUCTOS" del principio.
function leafCategory(categories: string[] | undefined): string {
  const first = categories?.[0];
  if (!first) return "Otros artículos";
  const parts = first.split(">").map((p) => p.trim());
  const meaningful = parts.filter((p) => !/^produccion$|^productos$/i.test(p));
  return meaningful[meaningful.length - 1] || parts[parts.length - 1] || "Otros artículos";
}

// Confirmado contra datos reales (material 12420 "Ecosum": baseQuantity
// 1000, scales [{quantity:1,amount:580}, {quantity:500,amount:560}, ...])
// — "amount" es el precio por cada `baseQuantity` unidades a ese tramo, NO
// un precio total ni un precio/unidad directo. "scales[].quantity" es el
// umbral de unidades pedidas al que se aplica ese precio (tramo de
// descuento por volumen), no un divisor. Coste/unidad al tramo más bajo
// (el que aplica a pedidos pequeños) = scales[0].amount / baseQuantity —
// para "Ecosum" eso da 580/1000 = 0,58 €/ud, no 580 €/ud.
function unitCostFromScales(row: MakitoPriceRow | undefined, baseQuantity: string): number | null {
  if (!row || row.scales.length === 0) return null;
  const base = parseFloat(baseQuantity) || 1000;
  const amount = parseFloat(row.scales[0].amount);
  if (!amount) return null;
  return amount / base;
}

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Makito sirve las imágenes con content-type: application/octet-stream (no
// image/*) — comprobado en directo, 2026-09-30 — así que no nos podemos
// fiar de su cabecera; se infiere del nombre de archivo en su lugar.
async function downloadAndStore(url: string, token: string, key: string): Promise<string | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXT_TO_CONTENT_TYPE[ext] ?? "image/jpeg";
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${SITE_URL}/api/uploads/${key}`;
}

async function main() {
  const { limit, env } = parseArgs();
  console.log(`Modo: ${env === "test" ? "cuenta de TEST" : "cuenta de PRODUCCIÓN"} · límite: ${limit ?? "sin límite (catálogo completo)"}\n`);

  const token = await login(env);
  console.log("Login OK.\n");

  const [catalogRes, stockRes, priceRes] = await Promise.all([
    fetch(`${BASE_URL}/catalog/files?format=JSON&lang=es`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE_URL}/stock/files?format=JSON`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE_URL}/price-list/files?format=JSON`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const catalog = (await catalogRes.json()) as { products: MakitoProduct[] };
  const stock = (await stockRes.json()) as { stocks: MakitoStockRow[] };
  const priceList = (await priceRes.json()) as { priceList: MakitoPriceRow[] };

  const stockByMaterial = new Map(stock.stocks.map((s) => [s.material, s.quantity]));
  const priceByMaterial = new Map(priceList.priceList.map((p) => [p.material, p]));

  console.log(`Catálogo: ${catalog.products.length} productos. Stock: ${stock.stocks.length} filas. Precios: ${priceList.priceList.length} filas.\n`);

  const products = limit ? catalog.products.slice(0, limit) : catalog.products;

  const supplier = await prisma.supplier.upsert({
    where: { name: "Makito" },
    update: {},
    create: { name: "Makito", adapterKey: "makito" },
  });

  const categoryCache = new Map<string, string>();
  async function categoryIdFor(name: string): Promise<string> {
    const cached = categoryCache.get(name);
    if (cached) return cached;
    const cat = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryCache.set(name, cat.id);
    return cat.id;
  }

  let productsWritten = 0;
  let variantsWritten = 0;
  let imagesDownloaded = 0;

  // Margen ×2 confirmado directamente por el dueño, 2026-09-30 — mismo
  // criterio que Cifra/Roly/Stamina.
  const MARGEN = 2;

  for (const p of products) {
    const priceRow = priceByMaterial.get(p.ref);
    const realUnitCost = unitCostFromScales(priceRow, priceRow?.baseQuantity ?? "1000");
    const basePrice = realUnitCost != null ? Math.round(realUnitCost * MARGEN * 100) / 100 : 0;
    const totalStock = (p.variants ?? [{ variant_reference: p.ref } as MakitoVariant]).reduce(
      (sum, v) => sum + (stockByMaterial.get(makitoMaterialCode(p.ref, v)) ?? 0),
      0
    );

    const categoryName = leafCategory(p.categories);
    const categoryId = await categoryIdFor(categoryName);

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: p.ref } },
      update: {
        name: p.name,
        description: (p.description ?? "").replace(/<[^>]+>/g, "").trim() || null,
        brand: "Makito",
        categoryId,
        basePrice,
        stock: totalStock,
        incompleteData: realUnitCost == null,
        lastSyncedAt: new Date(),
      },
      create: {
        supplierId: supplier.id,
        supplierSku: p.ref,
        name: p.name,
        description: (p.description ?? "").replace(/<[^>]+>/g, "").trim() || null,
        brand: "Makito",
        categoryId,
        basePrice,
        stock: totalStock,
        incompleteData: realUnitCost == null,
      },
    });

    // Imagen principal del producto (una por producto; las de variante se
    // podrían añadir después si hace falta distinguir por color).
    if (p.image) {
      const ext = p.image.split(".").pop() || "jpg";
      const key = `makito/${p.ref}/principal.${ext}`;
      const existing = await prisma.productImage.findFirst({ where: { productId: product.id } });
      if (!existing) {
        const url = await downloadAndStore(p.image, token, key);
        if (url) {
          await prisma.productImage.create({ data: { productId: product.id, url, position: 0 } });
          imagesDownloaded++;
        }
      }
    }

    const variants = p.variants && p.variants.length > 0 ? p.variants : [{ variant_reference: p.ref } as MakitoVariant];
    for (const v of variants) {
      const materialCode = makitoMaterialCode(p.ref, v);
      const variantStock = stockByMaterial.get(materialCode) ?? 0;
      await prisma.productVariant.upsert({
        where: { supplierModelCode: materialCode },
        update: {
          color: v.variant_name?.replace(p.name, "").trim() || null,
          price: basePrice,
          costUnit: realUnitCost,
          stock: variantStock,
          productId: product.id,
        },
        create: {
          productId: product.id,
          color: v.variant_name?.replace(p.name, "").trim() || null,
          price: basePrice,
          costUnit: realUnitCost,
          stock: variantStock,
          supplierModelCode: materialCode,
        },
      });
      variantsWritten++;
    }

    productsWritten++;
    if (productsWritten % 10 === 0) {
      console.log(`  ${productsWritten}/${products.length} productos (${variantsWritten} variantes, ${imagesDownloaded} imágenes)...`);
    }
  }

  console.log(`\nImportación completa: ${productsWritten} productos, ${variantsWritten} variantes, ${imagesDownloaded} imágenes descargadas.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
