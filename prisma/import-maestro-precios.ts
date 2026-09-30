// Carga el maestro de precios (Finanzas, 2026-09-30) en Product/
// ProductVariant. Solo lee CSV locales — no llama a ninguna API. Modo
// DRY-RUN por defecto (solo imprime el resumen, no escribe nada); pasar
// --apply para aplicar los cambios de verdad.
//
// Fuentes: E:\onion\26\finanzas\maestro-precios\csv\{Modelos,Variantes}.csv
// y factusol-import\Codigos_FACTUSOL.csv.
import fs from "node:fs";
import Papa from "papaparse";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MAESTRO_DIR = "E:\\onion\\26\\finanzas\\maestro-precios";
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

async function main() {
  console.log(APPLY ? "Modo: APLICAR cambios de verdad." : "Modo: DRY-RUN (nada se escribe, usa --apply para aplicar).");

  const modelos = parseCsv<ModeloRow>(`${MAESTRO_DIR}\\csv\\Modelos.csv`);
  const variantes = parseCsv<VarianteRow>(`${MAESTRO_DIR}\\csv\\Variantes.csv`);
  const codigosLargos = parseCsv<CodigoLargoRow>(`${MAESTRO_DIR}\\csv\\Codigos_largos.csv`);
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

  for (const row of variantes) {
    const pricePack = toNumOrNull(row.PVP_pack);
    const priceBox = toNumOrNull(row.PVP_caja);
    const costUnit = toNumOrNull(row.Coste_ud);
    const costPack = toNumOrNull(row.Coste_pack);
    const costBox = toNumOrNull(row.Coste_caja);

    if (APPLY) {
      const result = await prisma.productVariant.updateMany({
        where: { supplierModelCode: row.SKU_proveedor },
        data: {
          pricePack: pricePack !== null ? round(pricePack, 2) : null,
          priceBox: priceBox !== null ? round(priceBox, 2) : null,
          costUnit: costUnit !== null ? round(costUnit, 4) : null,
          costPack: costPack !== null ? round(costPack, 4) : null,
          costBox: costBox !== null ? round(costBox, 4) : null,
        },
      });
      if (result.count > 0) variantesUpdated += result.count;
      else {
        variantesNotFound++;
        if (variantNotFoundExamples.length < 5) variantNotFoundExamples.push(row.SKU_proveedor);
      }
    } else {
      if (existingVariantCodes.has(row.SKU_proveedor)) {
        variantesUpdated++;
      } else {
        variantesNotFound++;
        if (variantNotFoundExamples.length < 5) variantNotFoundExamples.push(row.SKU_proveedor);
      }
    }
  }

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
