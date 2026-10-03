// Carga precio y stock de Anbor desde su fichero "Tarifa/Stock" (el catálogo
// ya está importado con import-anbor.ts, sin precio ni stock). Hasta ahora
// los 256 productos de Anbor estaban invisibles.
//
// La tarifa trae 3 tramos por volumen: -100 (1-99 uds), -250 (100-249) y +250.
// Encajan en el modelo de tramos de la web: unidad = hasta 99, pack = desde
// 100 (unitsPerPack 100), caja = desde 250 (unitsPerCase 250). Venta = coste ×
// 2 como en el resto de proveedores. Stock = almacén principal + Mallorca.
//
// Run with: npx tsx prisma/apply-anbor-tarifa.ts <ruta al .xls> [--apply]
import * as XLSX from "xlsx";
import { prisma } from "./_client";

const MARGEN = 2;
const UNITS_PER_PACK = 100;
const UNITS_PER_CASE = 250;
const APPLY = process.argv.includes("--apply");

const H = {
  parent: "Referencia padre",
  variant: "Referencia variante",
  p100: "Precio por volumen -100",
  p250: "Precio por volumen -250",
  p250plus: "Precio por volumen +250",
  stockMain: "Stock Almacén Principal",
  stockMallorca: "Stock Almacén Mallorca",
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const money = (v: unknown) => parseFloat(String(v ?? "").replace("€", "").replace(",", ".").trim());
const int = (v: unknown) => Math.max(0, Math.floor(parseFloat(String(v ?? "").replace(",", ".")) || 0));

type Tariff = { parent: string; variant: string; c1: number; c2: number; c3: number; stock: number };

function readTariff(file: string): Tariff[] {
  const wb = XLSX.readFile(file);
  const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: "" }) as unknown[][];
  const headerAt = raw.findIndex((r) => r.map((c) => String(c).trim()).includes(H.variant));
  if (headerAt === -1) throw new Error(`No encuentro la cabecera "${H.variant}".`);
  const head = raw[headerAt].map((c) => String(c).trim());
  const col = Object.fromEntries(Object.entries(H).map(([k, label]) => {
    const i = head.indexOf(label);
    if (i === -1) throw new Error(`Falta la columna "${label}".`);
    return [k, i];
  })) as Record<keyof typeof H, number>;

  const out: Tariff[] = [];
  for (const r of raw.slice(headerAt + 1)) {
    const variant = String(r[col.variant] ?? "").trim();
    if (!variant) continue;
    out.push({
      parent: String(r[col.parent] ?? "").trim(),
      variant,
      c1: money(r[col.p100]),
      c2: money(r[col.p250]),
      c3: money(r[col.p250plus]),
      stock: int(r[col.stockMain]) + int(r[col.stockMallorca]),
    });
  }
  return out;
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Uso: npx tsx prisma/apply-anbor-tarifa.ts <ruta al .xls> [--apply]");
    process.exit(1);
  }
  console.log(APPLY ? "APLICANDO\n" : "DRY-RUN (usa --apply para escribir)\n");
  const rows = readTariff(file);
  console.log(`Filas de tarifa: ${rows.length}`);

  const supplier = await prisma.supplier.findUnique({ where: { name: "Anbor" } });
  if (!supplier) throw new Error('Proveedor "Anbor" no existe: importa antes el catálogo con import-anbor.ts.');

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: { id: true, supplierSku: true, _count: { select: { images: true } }, variants: { select: { id: true, supplierModelCode: true } } },
  });
  const variantByCode = new Map<string, { id: string; productId: string }>();
  for (const p of products) for (const v of p.variants) variantByCode.set(v.supplierModelCode, { id: v.id, productId: p.id });

  let missing = 0;
  let noPrice = 0;
  const byProduct = new Map<string, { price: number; stock: number }[]>();
  const updates: { id: string; data: Record<string, number> }[] = [];

  for (const t of rows) {
    const v = variantByCode.get(t.variant);
    if (!v) { missing++; continue; }
    const usable = t.c1 > 0;
    if (!usable) noPrice++;
    const cost1 = usable ? t.c1 : 0;
    const cost2 = t.c2 > 0 ? t.c2 : cost1;
    const cost3 = t.c3 > 0 ? t.c3 : cost2;
    const stock = usable ? t.stock : 0; // sin precio no se puede vender: stock 0
    updates.push({
      id: v.id,
      data: {
        costUnit: round4(cost1), costPack: round4(cost2), costBox: round4(cost3),
        price: round2(cost1 * MARGEN), pricePack: round2(cost2 * MARGEN), priceBox: round2(cost3 * MARGEN),
        stock,
      },
    });
    const list = byProduct.get(v.productId) ?? [];
    list.push({ price: round2(cost1 * MARGEN), stock });
    byProduct.set(v.productId, list);
  }

  let visible = 0;
  for (const p of products) {
    const list = byProduct.get(p.id) ?? [];
    const stock = list.reduce((s, x) => s + x.stock, 0);
    if (stock > 0 && list.some((x) => x.price > 0) && p._count.images > 0) visible++;
  }
  console.log(`Variantes de la tarifa que no están en la base de datos: ${missing}`);
  console.log(`Variantes sin precio (stock 0): ${noPrice}`);
  console.log(`Productos Anbor: ${products.length} · saldrían visibles (stock, precio y foto): ${visible}`);
  const s = updates.slice(0, 3).map((u) => `coste ${u.data.costUnit} → venta ${u.data.price}`);
  console.log(`Ejemplos: ${s.join(" | ")}`);

  if (APPLY) {
    let done = 0;
    for (const u of updates) {
      await prisma.productVariant.update({ where: { id: u.id }, data: u.data });
      if (++done % 500 === 0) console.log(`  ${done}/${updates.length} variantes...`);
    }
    for (const p of products) {
      const list = byProduct.get(p.id) ?? [];
      const prices = list.map((x) => x.price).filter((x) => x > 0);
      await prisma.product.update({
        where: { id: p.id },
        data: {
          basePrice: prices.length ? Math.min(...prices) : 0,
          stock: list.reduce((sum, x) => sum + x.stock, 0),
          unitsPerPack: UNITS_PER_PACK,
          unitsPerCase: UNITS_PER_CASE,
          incompleteData: false,
          lastSyncedAt: new Date(),
        },
      });
    }
    console.log(`\nActualizadas ${updates.length} variantes y ${products.length} productos.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
