// Nombres de producto repetidos (Josep, 2026-10-03): los proveedores llaman
// igual a varios artículos distintos por la colección o el diseño (Valento
// "THUNDER" son 10 artículos: polo, gorra, sudadera...; Makito "Epika" son 6)
// y el cliente ve varias tarjetas con el mismo nombre. Se les añade lo que
// los distingue: primero la categoría, si separa; después el color; y por
// último el código del proveedor si aún chocan: "THUNDER · Polos".
//
// Idempotente: el nombre base es lo que hay antes de " · " (ningún nombre de
// proveedor lo contiene), así que repetirlo da el mismo resultado, y un
// producto que deje de tener repetidos recupera su nombre base. Los importadores
// reescriben el nombre en cada sincronización, por eso sync-daily lo ejecuta
// al final.
//
// Los productos de un pack de precio cerrado NO se renombran: la URL del pack
// es el nombre + el código del producto.
//
// Run with: npx tsx prisma/disambiguate-names.ts [--apply] [--show=texto]
import { prisma } from "./_client";
import { PACKS } from "../src/lib/packs";
import { slugify } from "../src/lib/product-format";
import { displayCategoryName } from "../src/lib/category-display";

const APPLY = process.argv.includes("--apply");
const SEP = " · ";

type Item = { id: string; name: string; base: string; sku: string; supplierId: string; supplier: string; category: string; color: string };

function titleCase(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Añade a cada producto del grupo los atributos mínimos para que ninguno
// comparta nombre con otro.
export function suffixesFor(items: Item[]): Map<string, string> {
  const labels = new Map(items.map((i) => [i.id, [] as string[]]));
  // En Cifra la categoría es ruido (el mismo artículo en distintos colores cae
  // en "Otros artículos", "Bolsas", "Complementos y Detalles"...): lo que
  // distingue es el color. En el resto (Valento, Makito, Roly...) la categoría
  // sí separa tipos de prenda.
  const category = (i: Item) => (i.category === "Otros artículos" ? "" : displayCategoryName(i.category));
  const color = (i: Item) => titleCase(i.color);
  const sku = (i: Item) => i.sku;
  const attrs = items[0].supplier === "Cifra" ? [color, sku] : [category, color, sku];
  for (const attr of attrs) {
    const buckets = new Map<string, Item[]>();
    for (const i of items) {
      const key = normalize(labels.get(i.id)!.join(SEP));
      buckets.set(key, [...(buckets.get(key) ?? []), i]);
    }
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      const values = bucket.map(attr);
      if (new Set(values.map(normalize)).size < 2) continue; // este atributo no separa
      for (const [idx, i] of bucket.entries()) if (values[idx]) labels.get(i.id)!.push(values[idx]);
    }
  }
  return new Map([...labels].map(([id, parts]) => [id, parts.join(SEP)]));
}

async function main() {
  console.log(APPLY ? "APLICANDO\n" : "DRY-RUN (usa --apply para escribir)\n");
  const protectedSlugs = new Set(Object.values(PACKS).map((p) => p.productSlug));

  const rows = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      supplierSku: true,
      supplierId: true,
      supplier: { select: { name: true } },
      category: { select: { name: true } },
      variants: { where: { color: { not: null } }, distinct: ["color"], select: { color: true } },
    },
  });
  const items: Item[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    base: r.name.includes(SEP) ? r.name.slice(0, r.name.indexOf(SEP)) : r.name,
    sku: r.supplierSku,
    supplierId: r.supplierId,
    supplier: r.supplier.name,
    category: r.category?.name ?? "",
    // Solo si el producto tiene UN color: poner "Gris" a algo que se vende en
    // cuatro colores confundiría; en ese caso distingue el código.
    color: r.variants.length === 1 ? (r.variants[0].color ?? "") : "",
  }));

  const groups = new Map<string, Item[]>();
  for (const i of items) {
    const key = `${i.supplierId}|${normalize(i.base)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }

  const updates: { id: string; from: string; to: string }[] = [];
  let groupsWithDupes = 0;
  for (const group of groups.values()) {
    if (group.length < 2) {
      const only = group[0];
      if (only.name !== only.base) updates.push({ id: only.id, from: only.name, to: only.base });
      continue;
    }
    groupsWithDupes++;
    const suffixes = suffixesFor(group);
    for (const i of group) {
      if (protectedSlugs.has(slugify(`${i.name}-${i.sku}`))) continue;
      const suffix = suffixes.get(i.id);
      const target = suffix ? `${i.base}${SEP}${suffix}` : i.base;
      if (target !== i.name) updates.push({ id: i.id, from: i.name, to: target });
    }
  }

  console.log(`Grupos con nombre repetido: ${groupsWithDupes}`);
  console.log(`Nombres a cambiar: ${updates.length}`);
  const show = process.argv.find((a) => a.startsWith("--show="))?.split("=")[1]?.toLowerCase();
  const shown = show ? updates.filter((u) => u.from.toLowerCase().includes(show)) : updates.slice(0, 12);
  for (const u of shown) console.log(`  "${u.from}" → "${u.to}"`);

  if (APPLY) {
    for (const u of updates) await prisma.product.update({ where: { id: u.id }, data: { name: u.to } });
    console.log(`\nActualizados: ${updates.length}`);
  }
  await prisma.$disconnect();
}

if (/disambiguate-names(\.[cm]?[jt]s)?$/.test(process.argv[1] ?? "")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
