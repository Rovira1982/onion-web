// Makito — FASE 2 de 2 (ver prisma/import-makito.ts para la fase 1). Va
// producto a producto: descarga su foto (con el mismo Bearer token que el
// resto de la API — Makito exige auth también para imágenes, confirmado
// 401 sin token) y, solo si lo consigue, activa el producto poniéndole su
// stock real (hasta entonces se queda en 0/invisible a propósito, ver
// fase 1). Pensado para tardar horas en el catálogo completo (~4600
// productos, límite de Makito: 100 peticiones de capacidad, 25/min de
// recarga) — por eso pausa `--delay-ms` entre descargas y es reanudable:
// una re-ejecución se salta los productos que ya tengan foto.
//
// Run with: npx tsx prisma/makito-backfill-images.ts [--limit=25] [--env=test|prod] [--delay-ms=2500]
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { makitoMaterialCode } from "./import-makito";

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
  const delayArg = process.argv.find((a) => a.startsWith("--delay-ms="));
  return {
    limit: limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined,
    env: (envArg?.split("=")[1] as "test" | "prod") ?? "test",
    delayMs: delayArg ? parseInt(delayArg.split("=")[1], 10) : 2500,
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

let cachedToken: string | null = null;
function makeGetToken(env: "test" | "prod") {
  return async (forceRefresh = false): Promise<string> => {
    if (cachedToken && !forceRefresh) return cachedToken;
    cachedToken = await login(env);
    return cachedToken;
  };
}

type MakitoVariant = { variant_reference: string; variant_colorcode?: string; variant_size?: string };
type MakitoProduct = { ref: string; image?: string; variants?: MakitoVariant[] };
type MakitoStockRow = { material: string; quantity: number };

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Makito sirve las imágenes con content-type: application/octet-stream (no
// image/*) — confirmado en directo, 2026-09-30 — así que se infiere del
// nombre de archivo en vez de fiarse de su cabecera.
//
// Bug real encontrado en directo, 2026-09-30: el token se pedía una sola
// vez al arrancar y nunca se renovaba — en una ejecución larga (miles de
// fotos a 2,5s cada una) caduca a mitad, y cada descarga posterior fallaba
// en silencio (!res.ok) contándose como "sin foto disponible" cuando en
// realidad era un 401 de autenticación, no que la foto no existiera
// (comprobado: las 4609 fichas del catálogo SÍ tienen foto real).
//
// Segundo fallo transitorio encontrado en la misma sesión de pruebas: con
// token recién sacado (imposible que haya caducado) seguían fallando ~6 de
// cada 10 — otra sesión usa la misma cuenta de test de Makito en paralelo,
// probablemente chocando con su límite de peticiones (100 capacidad, 25/min
// de recarga, ver import-makito.ts). Reintenta con backoff ante cualquier
// fallo (401 con token nuevo, cualquier otro con una pequeña espera), no
// solo 401.
async function downloadAndStore(
  url: string,
  getToken: (forceRefresh?: boolean) => Promise<string>,
  key: string,
  attempt = 1
): Promise<string | null> {
  const token = await getToken(attempt > 1);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (attempt >= 4) return null;
    await sleep(1000 * attempt);
    return downloadAndStore(url, getToken, key, attempt + 1);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXT_TO_CONTENT_TYPE[ext] ?? "image/jpeg";
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${SITE_URL}/api/uploads/${key}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { limit, env, delayMs } = parseArgs();
  console.log(
    `Modo: ${env === "test" ? "cuenta de TEST" : "cuenta de PRODUCCIÓN"} · límite: ${limit ?? "sin límite"} · pausa entre fotos: ${delayMs}ms\n`
  );

  const getToken = makeGetToken(env);
  const token = await getToken();
  console.log("Login OK.\n");

  const [catalogRes, stockRes] = await Promise.all([
    fetch(`${BASE_URL}/catalog/files?format=JSON&lang=es`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE_URL}/stock/files?format=JSON`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const catalog = (await catalogRes.json()) as { products: MakitoProduct[] };
  const stock = (await stockRes.json()) as { stocks: MakitoStockRow[] };
  const stockByMaterial = new Map(stock.stocks.map((s) => [s.material, s.quantity]));

  console.log(`Catálogo: ${catalog.products.length} productos. Stock: ${stock.stocks.length} filas.\n`);

  const supplier = await prisma.supplier.findUnique({ where: { name: "Makito" } });
  if (!supplier) {
    console.error('Proveedor "Makito" no encontrado — ejecuta primero prisma/import-makito.ts (fase 1).');
    process.exit(1);
  }

  // Ya activados (tienen foto) — se saltan, para que una re-ejecución
  // reanude donde lo dejó en vez de volver a descargar todo.
  const alreadyDone = await prisma.product.findMany({
    where: { supplierId: supplier.id, images: { some: {} } },
    select: { supplierSku: true },
  });
  const doneSkus = new Set(alreadyDone.map((p) => p.supplierSku));
  console.log(`Ya activados en una ejecución anterior: ${doneSkus.size}.\n`);

  const pending = catalog.products.filter((p) => !doneSkus.has(p.ref) && p.image);
  const products = limit ? pending.slice(0, limit) : pending;
  console.log(`Pendientes de foto en este lote: ${products.length}.\n`);

  let activated = 0;
  let failed = 0;

  for (const p of products) {
    const dbProduct = await prisma.product.findUnique({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: p.ref } },
      include: { variants: true },
    });
    if (!dbProduct) {
      failed++;
      continue; // no está en fase 1 todavía (p.ej. se limitó con --limit ahí) — se salta
    }

    const ext = p.image!.split(".").pop() || "jpg";
    const key = `makito/${p.ref}/principal.${ext}`;
    const url = await downloadAndStore(p.image!, getToken, key);

    if (!url) {
      failed++;
      await sleep(delayMs);
      continue;
    }

    const variants = p.variants ?? [];
    const totalStock = variants.reduce((sum, v) => sum + (stockByMaterial.get(makitoMaterialCode(p.ref, v)) ?? 0), 0);

    try {
      await prisma.$transaction(
        [
          prisma.productImage.create({ data: { productId: dbProduct.id, url, position: 0 } }),
          prisma.product.update({ where: { id: dbProduct.id }, data: { stock: totalStock } }),
          ...variants.map((v) =>
            prisma.productVariant.updateMany({
              where: { supplierModelCode: makitoMaterialCode(p.ref, v) },
              data: { stock: stockByMaterial.get(makitoMaterialCode(p.ref, v)) ?? 0 },
            })
          ),
        ],
        // Proxy público de Railway va lento con varias operaciones — el
        // timeout de 5s por defecto de Prisma no es suficiente aquí (visto
        // en directo: 5335ms en un producto con pocas variantes, y hasta
        // 20331ms en uno con muchas — subido a 30s con margen).
        { timeout: 30000 }
      );
      activated++;
    } catch (err) {
      // Bug real encontrado en directo, 2026-10-01: este fallo (P2028,
      // timeout de transacción) tumbaba el script ENTERO a mitad de un lote
      // de miles de productos, perdiendo el progreso de log (aunque no el
      // de BD, ya hecho commit producto a producto) — un solo producto lento
      // no debe tirar todo el lote abajo.
      failed++;
      console.log(`  ⚠ Fallo en ${p.ref}, lo salto: ${(err as Error).message.slice(0, 150)}`);
    }

    if ((activated + failed) % 20 === 0) {
      console.log(`  ${activated} activados, ${failed} sin foto disponible (de ${products.length} en este lote)...`);
    }

    await sleep(delayMs);
  }

  console.log(`\nFase 2 completa (este lote): ${activated} productos activados con foto, ${failed} sin foto disponible.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la fase 2:", err);
  process.exit(1);
});
