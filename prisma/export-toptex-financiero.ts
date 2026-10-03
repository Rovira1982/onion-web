// Export de solo lectura para Director financiero (2026-09-30) — NO toca
// la base de datos ni la web. Lee la API de TopTex en directo (mismo
// login + paginación que import-toptex.ts) y escribe
// E:\onion\26\finanzas\proveedores\toptex-costes-live.csv.
//
// El precio viene de una llamada autenticada con las credenciales reales
// de la cuenta de Josep (TOPTEX_USERNAME/PASSWORD) — es la tarifa de SU
// cuenta B2B, no un endpoint público anónimo. No puedo confirmar al 100%
// si ya lleva aplicado algún descuento comercial adicional negociado
// aparte (eso solo lo sabe TopTex o el propio acuerdo firmado) — lo que sí
// está verificado en directo (import-toptex.ts) es que el precio público
// en toptex.es es ~ese precio × 2, igual que el resto de proveedores.
//
// Run with: npx tsx prisma/export-toptex-financiero.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "./_client";
import { csvEscape, writeCsv } from "./_util";


const BASE_URL = process.env.TOPTEX_BASE_URL ?? "https://api.toptex.io";
const BULK_PAGE_SIZE = 500;

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
  return res.json();
}

type ToptexPriceTier = { quantity: string; price: number };
type ToptexPrice = { sku: string; prices: ToptexPriceTier[] };

async function fetchAllPages<T>(pathBase: string, itemsKey = "items"): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = Infinity;
  while (page <= totalPages) {
    const res = (await toptexGet(`${pathBase}&page_number=${page}&page_size=${BULK_PAGE_SIZE}`)) as {
      [key: string]: unknown;
      total_count?: number;
    };
    const items = (res[itemsKey] as T[]) ?? [];
    if (items.length === 0) break;
    all.push(...items);
    if (page === 1 && typeof res.total_count === "number") {
      totalPages = Math.ceil(res.total_count / BULK_PAGE_SIZE);
    }
    console.log(`  página ${page}/${Number.isFinite(totalPages) ? totalPages : "?"} (${all.length} filas)...`);
    page++;
  }
  return all;
}


async function main() {
  console.log("Descargando precios de TopTex (paginado)...\n");
  const allPrices = await fetchAllPages<ToptexPrice>(`/v3/products/price?`);
  console.log(`\n${allPrices.length} SKUs con precio.\n`);

  // catalogReference (familia) por SKU — se saca de nuestra BD en vez de
  // volver a paginar el catálogo completo de TopTex (pesado y con páginas
  // que fallan, ver import-toptex.ts): el mapeo sku->familia no cambia con
  // el precio, así que el último import ya sincronizado sirve.
  const supplier = await prisma.supplier.findUnique({ where: { name: "TopTex" } });
  const variants = supplier
    ? await prisma.productVariant.findMany({
        where: { product: { supplierId: supplier.id } },
        select: { supplierModelCode: true, product: { select: { supplierSku: true } } },
      })
    : [];
  const catalogRefBySku = new Map(variants.map((v) => [v.supplierModelCode, v.product.supplierSku]));

  const header = ["sku", "catalogReference", "tramo_num", "tramo_cantidad_minima", "precio"];
  const rows = [header.join(",")];
  for (const p of allPrices) {
    const catalogReference = catalogRefBySku.get(p.sku) ?? "";
    (p.prices ?? []).forEach((tier, idx) => {
      rows.push([p.sku, catalogReference, idx, tier.quantity, tier.price].map(csvEscape).join(","));
    });
  }

  const outPath = "E:\\onion\\26\\finanzas\\proveedores\\toptex-costes-live.csv";
  writeCsv(outPath, rows);
  console.log(`Escrito: ${outPath} (${rows.length - 1} filas)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error generando el export:", err);
  process.exit(1);
});
