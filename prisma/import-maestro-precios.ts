// Carga el maestro de precios (Finanzas, 2026-09-30) en Product/
// ProductVariant. Solo lee CSV locales — no llama a ninguna API. Modo
// DRY-RUN por defecto (solo imprime el resumen, no escribe nada); pasar
// --apply para aplicar los cambios de verdad.
//
// Fuentes: E:\onion\26\finanzas\maestro-precios\csv\{Modelos,Variantes}.csv
// y factusol-import\Codigos_FACTUSOL.csv.
import fs from "node:fs";
import Papa from "papaparse";
import { Prisma } from "../src/generated/prisma";
import { prisma } from "./_client";
import { config } from "dotenv";
config({ path: ".env.local" });

const VARIANT_BATCH_SIZE = 500; // ~250 round trips instead of 122k — public proxy latency makes one-by-one impractical


const MAESTRO_ROOT = "E:\\onion\\26\\finanzas\\maestro-precios";
// --dir=csv_v1.4 to point at a different export (e.g. a pricing-rule
// revision) without touching the default "csv" folder.
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const MAESTRO_DIR = `${MAESTRO_ROOT}\\${dirArg ? dirArg.slice("--dir=".length) : "csv"}`;
const APPLY = process.argv.includes("--apply");

type ModeloRow = {
  Proveedor: string;
  Codigo_proveedor: string;
  Codigo_Onion: string;
  Uds_pack: string;
  Uds_caja: string;
  Cant_min_pedido: string;
  Coste_ud_min: string;
  // v1.3 (Finanzas, 2026-09-30): raíz sin color — para Cifra varias filas
  // (una por color) comparten Modelo_raiz y son EL MISMO Product en mi BD;
  // para el resto de proveedores Modelo_raiz === Codigo_proveedor.
  Modelo_raiz: string;
};

type VarianteRow = {
  Proveedor: string;
  SKU_proveedor: string;
  Coste_ud: string;
  Coste_pack: string;
  Coste_caja: string;
  PVP_ud: string;
  PVP_pack: string;
  PVP_caja: string;
};

type CodigoLargoRow = {
  Proveedor: string;
  Codigo_proveedor: string;
  "Codigo_Onion_definitivo (EDITABLE)": string;
};

function parseCsv<T>(path: string): T[] {
  const raw = fs.readFileSync(path, "utf-8");
  const result = Papa.parse<T>(raw, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    console.log(`  ⚠ ${result.errors.length} error(es) de parseo en ${path} (primeros 3):`, result.errors.slice(0, 3));
  }
  return result.data;
}

function toNumOrNull(s: string | undefined): number | null {
  if (!s || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function round2OrNull(n: number | null): number | null {
  return n === null ? null : round(n, 2);
}

function round4OrNull(n: number | null): number | null {
  return n === null ? null : round(n, 4);
}

async function main() {
  console.log(APPLY ? "Modo: APLICAR cambios de verdad." : "Modo: DRY-RUN (nada se escribe, usa --apply para aplicar).");

  const modelos = parseCsv<ModeloRow>(`${MAESTRO_DIR}\\Modelos.csv`);
  const variantes = parseCsv<VarianteRow>(`${MAESTRO_DIR}\\Variantes.csv`);
  // Codigos_largos.csv only exists in the base "csv" export — v1.4 only
  // touches PVP_pack/PVP_caja, no need to duplicate it there.
  const codigosLargos = parseCsv<CodigoLargoRow>(`${MAESTRO_ROOT}\\csv\\Codigos_largos.csv`);
  console.log(`Leídos: ${modelos.length} modelos, ${variantes.length} variantes, ${codigosLargos.length} códigos largos.`);

  const factusolByKey = new Map(
    codigosLargos
      .filter((r) => r["Codigo_Onion_definitivo (EDITABLE)"]?.trim())
      .map((r) => [`${r.Proveedor}|${r.Codigo_proveedor}`, r["Codigo_Onion_definitivo (EDITABLE)"].trim()])
  );

  const suppliers = await prisma.supplier.findMany();
  const supplierByName = new Map(suppliers.map((s) => [s.name, s]));

  // Preloaded once for dry-run existence checks — 122k findUnique() round
  // trips would be far too slow, a Set lookup is instant.
  const existingVariantCodes = new Set(
    (await prisma.productVariant.findMany({ select: { supplierModelCode: true } })).map((v) => v.supplierModelCode)
  );
  const existingProductKeys = new Set(
    (await prisma.product.findMany({ select: { supplierId: true, supplierSku: true } })).map(
      (p) => `${p.supplierId}|${p.supplierSku}`
    )
  );

  // v1.3: agrupar por (Proveedor, Modelo_raiz) — Cifra trae varias filas
  // (una por color) que son el mismo Product en mi BD; el resto de
  // proveedores tiene Modelo_raiz === Codigo_proveedor, grupo de 1.
  // Criterio acordado con Finanzas: Coste_ud_min = el más bajo del grupo;
  // el resto de campos (Uds_pack/Uds_caja/Cant_min_pedido/Codigo_Onion) del
  // primer hijo por orden de Codigo_proveedor.
  const modeloGroups = new Map<string, ModeloRow[]>();
  for (const row of modelos) {
    const key = `${row.Proveedor}|${row.Modelo_raiz}`;
    const group = modeloGroups.get(key);
    if (group) group.push(row);
    else modeloGroups.set(key, [row]);
  }

  let modelosUpdated = 0;
  let modelosNotFound = 0;
  let modelosIncomplete = 0;
  let modelosGrouped = 0;
  const notFoundExamples: string[] = [];

  for (const [, group] of modeloGroups) {
    const sorted = group.slice().sort((a, b) => a.Codigo_proveedor.localeCompare(b.Codigo_proveedor));
    const first = sorted[0];
    if (sorted.length > 1) modelosGrouped++;

    const supplier = supplierByName.get(first.Proveedor);
    if (!supplier) {
      modelosNotFound++;
      if (notFoundExamples.length < 5) notFoundExamples.push(`proveedor desconocido: ${first.Proveedor}`);
      continue;
    }
    const unitsPerPack = toNumOrNull(first.Uds_pack);
    const unitsPerCase = toNumOrNull(first.Uds_caja);
    const minOrderQty = toNumOrNull(first.Cant_min_pedido);
    const incompleteData = unitsPerPack === null || unitsPerCase === null;
    if (incompleteData) modelosIncomplete++;

    const factusolCode = factusolByKey.get(`${first.Proveedor}|${first.Codigo_proveedor}`) ?? first.Codigo_Onion;

    if (APPLY) {
      const result = await prisma.product.updateMany({
        where: { supplierId: supplier.id, supplierSku: first.Modelo_raiz },
        data: {
          unitsPerPack,
          unitsPerCase,
          minOrderQty,
          supplierCode: first.Codigo_Onion,
          factusolCode,
          incompleteData,
        },
      });
      if (result.count > 0) modelosUpdated += result.count;
      else {
        modelosNotFound++;
        if (notFoundExamples.length < 5) notFoundExamples.push(`${first.Proveedor} ${first.Modelo_raiz} (modelo no encontrado en BD)`);
      }
    } else {
      if (existingProductKeys.has(`${supplier.id}|${first.Modelo_raiz}`)) {
        modelosUpdated++;
      } else {
        modelosNotFound++;
        if (notFoundExamples.length < 5) notFoundExamples.push(`${first.Proveedor} ${first.Modelo_raiz} (modelo no encontrado en BD)`);
      }
    }
  }

  console.log(`\nModelos: ${modelosUpdated} encontrados/actualizados, ${modelosNotFound} no encontrados, ${modelosIncomplete} con dato incompleto (repliegue a unidad), ${modelosGrouped} agrupados por Modelo_raiz (varios colores → 1 Product).`);
  if (notFoundExamples.length) console.log("Ejemplos no encontrados:", notFoundExamples);

  let variantesUpdated = 0;
  let variantesNotFound = 0;
  const variantNotFoundExamples: string[] = [];

  type VariantUpdate = {
    sku: string;
    pricePack: number | null;
    priceBox: number | null;
    costUnit: number | null;
    costPack: number | null;
    costBox: number | null;
  };
  const variantBatch: VariantUpdate[] = [];

  async function flushVariantBatch() {
    if (variantBatch.length === 0) return;
    const values = variantBatch.map(
      (r) =>
        Prisma.sql`(${r.sku}::text, ${r.pricePack}::numeric, ${r.priceBox}::numeric, ${r.costUnit}::numeric, ${r.costPack}::numeric, ${r.costBox}::numeric)`
    );
    await prisma.$executeRaw`
      UPDATE product_variants AS pv
      SET "pricePack" = v.price_pack, "priceBox" = v.price_box, "costUnit" = v.cost_unit, "costPack" = v.cost_pack, "costBox" = v.cost_box
      FROM (VALUES ${Prisma.join(values)}) AS v(sku, price_pack, price_box, cost_unit, cost_pack, cost_box)
      WHERE pv."supplierModelCode" = v.sku
    `;
    variantesUpdated += variantBatch.length;
    variantBatch.length = 0;
  }

  let variantRowsProcessed = 0;
  for (const row of variantes) {
    if (!existingVariantCodes.has(row.SKU_proveedor)) {
      variantesNotFound++;
      if (variantNotFoundExamples.length < 5) variantNotFoundExamples.push(row.SKU_proveedor);
      continue;
    }

    if (APPLY) {
      variantBatch.push({
        sku: row.SKU_proveedor,
        pricePack: round2OrNull(toNumOrNull(row.PVP_pack)),
        priceBox: round2OrNull(toNumOrNull(row.PVP_caja)),
        costUnit: round4OrNull(toNumOrNull(row.Coste_ud)),
        costPack: round4OrNull(toNumOrNull(row.Coste_pack)),
        costBox: round4OrNull(toNumOrNull(row.Coste_caja)),
      });
      if (variantBatch.length >= VARIANT_BATCH_SIZE) await flushVariantBatch();
    } else {
      variantesUpdated++;
    }

    variantRowsProcessed++;
    if (APPLY && variantRowsProcessed % 10000 === 0) {
      console.log(`  ...${variantRowsProcessed}/${variantes.length} variantes procesadas`);
    }
  }
  if (APPLY) await flushVariantBatch();

  console.log(`\nVariantes: ${variantesUpdated} encontradas/actualizadas, ${variantesNotFound} no encontradas.`);
  if (variantNotFoundExamples.length) console.log("Ejemplos no encontrados:", variantNotFoundExamples);

  if (!APPLY) {
    console.log("\nDRY-RUN completo. Relanza con --apply para escribir de verdad.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
