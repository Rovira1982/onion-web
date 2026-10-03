// Import del catálogo Anbor (proveedor nuevo) desde el .xls que exporta su
// portal. Ese fichero NO trae precio ni stock (solo ficha de producto:
// nombre, descripción, composición, imágenes) — se importa con
// price/stock = 0 a propósito. Todas las consultas de catálogo
// (src/lib/products.ts) filtran `stock: { gt: 0 }`, así que estos
// productos no aparecerán en ningún listado hasta que se cargue un
// fichero de tarifa/stock real y se actualicen esos campos.
//
// Usa el paquete "xlsx" (SheetJS) para leer el formato .xls antiguo —
// exceljs solo soporta .xlsx. Solo se usa en scripts de importación
// locales sobre ficheros que nosotros mismos descargamos del proveedor,
// nunca sobre contenido subido por usuarios de la web.
//
// Las columnas se localizan POR NOMBRE (fila de cabecera "Referencia
// padre"/"Referencia variante"/...), no por posición fija: la primera
// versión de este script usaba índices fijos copiados de una lectura con
// xlrd (Python), pero xlrd y SheetJS no coinciden en si incluyen columnas
// vacías al principio de la hoja — SheetJS omite la columna A si nunca
// tiene celdas, xlrd no. Eso desplazó todo un puesto y mezcló
// Referencia variante con EAN (detectado y corregido 2026-09-30, ver
// commit). Buscar por nombre de cabecera es inmune a ese desajuste.
//
// Run with: npx tsx prisma/import-anbor.ts -- <ruta al .xls>
import { config } from "dotenv";
config({ path: ".env.local" });

import * as path from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "./_client";
import { cleanName, cleanDescription } from "./text-clean";


const HEADER_NAMES = {
  parentRef: "Referencia padre",
  variantRef: "Referencia variante",
  size: "Talla",
  color: "Color",
  nameEs: "Nombre:ES",
  descriptionEs: "Descripción:ES",
  materialEs: "Composición:ES",
  images: "Imágenes",
} as const;

const CHILD_CATEGORY_SLUG = "ropa"; // categoría "Ropa" bajo "Ropa Laboral" — mismo cajón que Roly/Valento

function htmlBreaksToNewlines(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Row = {
  parentRef: string;
  variantRef: string;
  size: string | null;
  color: string | null;
  name: string;
  description: string;
  material: string | null;
  images: string[];
};

function findHeaderRow(raw: unknown[][]): { rowIndex: number; colIndex: Record<keyof typeof HEADER_NAMES, number> } {
  for (let i = 0; i < raw.length; i++) {
    const row = (raw[i] as string[]).map((c) => String(c ?? "").trim());
    if (row.includes(HEADER_NAMES.parentRef) && row.includes(HEADER_NAMES.variantRef)) {
      const colIndex = {} as Record<keyof typeof HEADER_NAMES, number>;
      for (const [key, label] of Object.entries(HEADER_NAMES) as [keyof typeof HEADER_NAMES, string][]) {
        const idx = row.indexOf(label);
        if (idx === -1) throw new Error(`Columna "${label}" no encontrada en la cabecera del .xls.`);
        colIndex[key] = idx;
      }
      return { rowIndex: i, colIndex };
    }
  }
  throw new Error(`No se encontró la fila de cabecera (busco "${HEADER_NAMES.parentRef}") en el .xls.`);
}

function readRows(filePath: string): Row[] {
  const wb = XLSX.readFile(filePath, { cellText: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });

  const { rowIndex: headerRow, colIndex: col } = findHeaderRow(raw);
  console.log(`Cabecera encontrada en la fila ${headerRow + 1}, columnas: ${JSON.stringify(col)}`);

  const rows: Row[] = [];
  for (let i = headerRow + 1; i < raw.length; i++) {
    const r = raw[i] as string[];
    const parentRef = String(r[col.parentRef] ?? "").trim();
    const variantRef = String(r[col.variantRef] ?? "").trim();
    if (!parentRef || !variantRef) continue;

    const imagesRaw = String(r[col.images] ?? "");
    const images = imagesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    rows.push({
      parentRef,
      variantRef,
      size: String(r[col.size] ?? "").trim() || null,
      color: String(r[col.color] ?? "").trim() || null,
      name: String(r[col.nameEs] ?? "").trim(),
      description: htmlBreaksToNewlines(String(r[col.descriptionEs] ?? "")),
      material: String(r[col.materialEs] ?? "").trim() || null,
      images,
    });
  }
  return rows;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npx tsx prisma/import-anbor.ts <ruta al .xls>");
    process.exit(1);
  }

  console.log(`Leyendo ${path.basename(filePath)}...`);
  const rows = readRows(filePath);
  console.log(`${rows.length} filas de variante leídas.\n`);

  const supplier = await prisma.supplier.upsert({
    where: { name: "Anbor" },
    update: {},
    create: { name: "Anbor", adapterKey: "anbor" },
  });

  const category = await prisma.category.findUnique({ where: { slug: CHILD_CATEGORY_SLUG } });
  if (!category) {
    console.error(`No se encontró la categoría "${CHILD_CATEGORY_SLUG}" — abortando.`);
    process.exit(1);
  }

  const byParent = new Map<string, Row[]>();
  for (const row of rows) {
    if (!byParent.has(row.parentRef)) byParent.set(row.parentRef, []);
    byParent.get(row.parentRef)!.push(row);
  }
  console.log(`${byParent.size} modelos (Referencia padre) distintos.\n`);

  let products = 0;
  let variants = 0;

  for (const [parentRef, group] of byParent) {
    const rep = group[0];

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: parentRef } },
      update: {
        name: cleanName(rep.name),
        description: cleanDescription(rep.description) || null,
        material: rep.material,
        brand: "Anbor",
        categoryId: category.id,
        // Sin precio/stock real todavía (ver cabecera) — no se toca
        // basePrice/stock en el update para no pisar un futuro import de
        // tarifa con datos reales si este script se re-ejecuta antes.
        lastSyncedAt: new Date(),
      },
      create: {
        supplierId: supplier.id,
        supplierSku: parentRef,
        name: cleanName(rep.name),
        description: cleanDescription(rep.description) || null,
        material: rep.material,
        brand: "Anbor",
        categoryId: category.id,
        basePrice: 0,
        stock: 0,
        incompleteData: true,
      },
    });

    const images = [...new Set(group.flatMap((r) => r.images))];
    for (const [i, url] of images.entries()) {
      const existing = await prisma.productImage.findFirst({ where: { productId: product.id, url } });
      if (!existing) {
        await prisma.productImage.create({ data: { productId: product.id, url, position: i } });
      }
    }

    for (const row of group) {
      await prisma.productVariant.upsert({
        where: { supplierModelCode: row.variantRef },
        update: {
          size: row.size,
          color: row.color,
          productId: product.id,
        },
        create: {
          productId: product.id,
          size: row.size,
          color: row.color,
          price: 0,
          stock: 0,
          supplierModelCode: row.variantRef,
        },
      });
      variants++;
    }

    products++;
    if (products % 50 === 0) console.log(`  ${products}/${byParent.size} productos (${variants} variantes)...`);
  }

  console.log(`\nImportación completa: ${products} productos, ${variants} variantes.`);
  console.log(`Todos con precio/stock = 0 — invisibles en el catálogo hasta cargar tarifa+stock reales.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
