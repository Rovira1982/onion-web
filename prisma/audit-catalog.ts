// Auditoría de calidad de datos del catálogo (pedida por Josep vía
// Operaciones, 2026-10-02) — pensada para correr tras cada importación de
// proveedor. Por defecto SOLO INFORMA; con --fix aplica únicamente lo que es
// seguro y mecánico (espacios, HTML suelto, fotos con la misma URL repetida,
// fotos cuyo color solo difiere en mayúsculas/acentos de un color real, URLs
// de localhost). Todo lo dudoso queda listado sin tocar.
//
// Alcance: productos visibles en la web (stock > 0).
//
// Run with: npx tsx prisma/audit-catalog.ts [--fix] [--out=ruta.md]
import { config } from "dotenv";
config({ path: ".env.local" });
import { appendFileSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FIX = process.argv.includes("--fix");
const DELETE_LOG = `audit-catalog-deleted-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const NO_DELETE =process.argv.includes("--no-delete"); // con --fix: solo actualiza, no borra filas
const OUT = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];
const PAGE = 300;
const EXAMPLES_PER_CASE = 4;

const CONTROLS = {
  c1: "Colores con talla pegada o texto raro",
  c2: "Variantes sin talla o sin color (mezcladas con variantes que sí la tienen)",
  c3: "Fotos duplicadas por producto",
  c4: "Fotos huérfanas (color que no casa con ninguna variante)",
  c5: "Colores de variante sin ninguna foto (en productos con galería por color)",
  c6: "Producto sin foto, sin nombre válido o sin descripción",
  c7: "Textos rotos (HTML/entidades, espacios) y nombres duplicados entre productos",
  c8: "Precios a cero o fuera de lo normal",
} as const;
type ControlId = keyof typeof CONTROLS;

type Case = { count: number; examples: string[] };
const findings = new Map<string, Case>(); // `${control}|${supplier}|${kind}`
const fixed = new Map<string, number>(); // `${control}|${kind}`
const scannedBySupplier = new Map<string, number>();

function flag(control: ControlId, supplier: string, kind: string, example: string) {
  const key = `${control}|${supplier}|${kind}`;
  const c = findings.get(key) ?? { count: 0, examples: [] };
  c.count++;
  if (c.examples.length < EXAMPLES_PER_CASE) c.examples.push(example);
  findings.set(key, c);
}
function markFixed(control: ControlId, kind: string, n = 1) {
  const key = `${control}|${kind}`;
  fixed.set(key, (fixed.get(key) ?? 0) + n);
}

const SIZE_TAIL = /\s(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|[2-6]XL)$/i;
const HTML_REMNANT = /<\/?[a-z][^>]*>|&[a-z]{2,8};|&#\d+;/i;
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ntilde: "ñ", Ntilde: "Ñ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É",
  Iacute: "Í", Oacute: "Ó", Uacute: "Ú", uuml: "ü", Uuml: "Ü", ordm: "º", ordf: "ª",
  euro: "€", deg: "°", middot: "·", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
};

function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function colorKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function nameKey(s: string): string {
  return colorKey(s);
}

type AuditProduct = {
  id: string;
  name: string;
  description: string | null;
  basePrice: { toString(): string };
  supplierSku: string;
  supplier: { name: string };
  variants: { id: string; size: string | null; color: string | null; price: { toString(): string }; stock: number }[];
  images: { id: string; url: string; color: string | null; position: number }[];
};

const namesSeen = new Map<string, { id: string; supplier: string; sku: string }[]>();

async function auditProduct(p: AuditProduct) {
  const sup = p.supplier.name;
  scannedBySupplier.set(sup, (scannedBySupplier.get(sup) ?? 0) + 1);
  const label = `${p.name} [${p.supplierSku}]`;

  // ---- C7 texto: nombre y descripción ----
  const nameClean = HTML_REMNANT.test(p.name) ? cleanText(p.name) : squash(p.name);
  if (nameClean !== p.name) {
    flag("c7", sup, "nombre con espacios/HTML", label);
    if (FIX && nameClean.length >= 2) {
      await prisma.product.update({ where: { id: p.id }, data: { name: nameClean } });
      markFixed("c7", "nombre limpiado");
    }
  }
  if (p.description && HTML_REMNANT.test(p.description)) {
    const cleaned = cleanText(p.description);
    flag("c7", sup, "descripción con HTML/entidades", label);
    if (FIX) {
      await prisma.product.update({ where: { id: p.id }, data: { description: cleaned || null } });
      markFixed("c7", "descripción limpiada");
      if (HTML_REMNANT.test(cleaned)) flag("c7", sup, "descripción con HTML que no se pudo limpiar del todo", label);
    }
  }
  if (/\b(undefined|null|NaN)\b/.test(p.name) || (p.description && /\b(undefined|NaN)\b/.test(p.description))) {
    flag("c7", sup, "texto con 'undefined'/'null'/'NaN'", label);
  }
  const nk = nameKey(p.name);
  if (nk) {
    const list = namesSeen.get(nk) ?? [];
    list.push({ id: p.id, supplier: sup, sku: p.supplierSku });
    namesSeen.set(nk, list);
  }

  // ---- C6 nombre / descripción / foto ----
  if (nameClean.length < 3 || nameClean.toLowerCase() === p.supplierSku.toLowerCase()) {
    flag("c6", sup, "nombre vacío, demasiado corto o igual al SKU", label);
  }
  if (!p.description || !p.description.trim()) flag("c6", sup, "sin descripción", label);
  const realImages = p.images.filter((i) => i.url && i.url.trim());
  if (realImages.length === 0) flag("c6", sup, "sin ninguna foto", label);

  // ---- URLs de localhost (fix seguro) ----
  for (const img of p.images) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(img.url)) {
      flag("c6", sup, "foto con URL de localhost", `${label} ${img.url}`);
      if (FIX) {
        const rel = img.url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, "");
        if (rel.startsWith("/api/uploads/")) {
          await prisma.productImage.update({ where: { id: img.id }, data: { url: rel } });
          img.url = rel;
          markFixed("c6", "URL localhost → ruta relativa");
        }
      }
    }
  }

  // ---- C1 colores sucios ----
  const colorOf = new Map<string, string>(); // variantId → color normalizado (espacios)
  for (const v of p.variants) {
    if (v.color == null) continue;
    const sq = squash(v.color);
    colorOf.set(v.id, sq);
    if (sq !== v.color) {
      flag("c1", sup, "color con espacios de más", `${label} → "${v.color}"`);
    }
    if (SIZE_TAIL.test(sq)) flag("c1", sup, "color termina en talla", `${label} → "${sq}"`);
    else if (sq.length > 30 && !/[\/-]/.test(sq)) flag("c1", sup, "color demasiado largo (>30)", `${label} → "${sq}"`);
    else if (sq.toLowerCase().includes(p.name.toLowerCase()) && p.name.length >= 3)
      flag("c1", sup, "color contiene el nombre del producto", `${label} → "${sq}"`);
    else if (/[|\\_]|\d{4,}|talla/i.test(sq))
      flag("c1", sup, "color con caracteres/dígitos raros", `${label} → "${sq}"`);
  }
  const needsColorSquash = p.variants.some((v) => v.color != null && squash(v.color) !== v.color);
  if (FIX && needsColorSquash) {
    for (const v of p.variants) {
      if (v.color != null && squash(v.color) !== v.color) {
        await prisma.productVariant.update({ where: { id: v.id }, data: { color: squash(v.color) } });
        markFixed("c1", "espacios de color normalizados");
        v.color = squash(v.color);
      }
    }
    for (const img of p.images) {
      if (img.color != null && squash(img.color) !== img.color) {
        await prisma.productImage.update({ where: { id: img.id }, data: { color: squash(img.color) } });
        img.color = squash(img.color);
      }
    }
  }

  // ---- C2 variantes sin talla / sin color (solo si es mixto) ----
  const withSize = p.variants.filter((v) => v.size && v.size.trim());
  const withColor = p.variants.filter((v) => v.color && v.color.trim());
  if (withSize.length > 0 && withSize.length < p.variants.length)
    flag("c2", sup, "algunas variantes sin talla (otras sí)", label);
  if (withColor.length > 0 && withColor.length < p.variants.length)
    flag("c2", sup, "algunas variantes sin color (otras sí)", label);
  if (p.variants.length === 0) flag("c2", sup, "producto visible sin ninguna variante", label);

  // ---- C4 huérfanas: intenta casar por normalización (fix seguro) ----
  const variantColors = [...new Set(p.variants.map((v) => v.color).filter((c): c is string => !!c))];
  const variantByKey = new Map<string, string[]>();
  for (const c of variantColors) {
    const k = colorKey(c);
    variantByKey.set(k, [...(variantByKey.get(k) ?? []), c]);
  }
  const validSet = new Set(variantColors);
  for (const img of p.images) {
    if (!img.color || validSet.has(img.color)) continue;
    const candidates = variantByKey.get(colorKey(img.color));
    if (candidates && candidates.length === 1) {
      flag("c4", sup, "foto con color casi igual (mayúsculas/acentos)", `${label} "${img.color}" → "${candidates[0]}"`);
      if (FIX) {
        await prisma.productImage.update({ where: { id: img.id }, data: { color: candidates[0] } });
        markFixed("c4", "color de foto realineado con la variante");
        img.color = candidates[0];
      }
    } else {
      flag("c4", sup, "foto huérfana sin color equivalente", `${label} "${img.color}"`);
    }
  }

  // ---- C3 duplicadas ----
  const seenUrl = new Map<string, string>();
  const dupIds: string[] = [];
  for (const img of [...p.images].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
    if (seenUrl.has(img.url)) dupIds.push(img.id);
    else seenUrl.set(img.url, img.id);
  }
  if (dupIds.length) {
    flag("c3", sup, "foto con la misma URL repetida", `${label} (${dupIds.length} repetidas)`);
    if (FIX && !NO_DELETE) {
      // Registro ANTES de borrar (fila completa) para poder restaurar.
      const gone = new Set(dupIds);
      for (const row of p.images.filter((i) => gone.has(i.id))) {
        appendFileSync(DELETE_LOG, JSON.stringify({ productId: p.id, row }) + "\n");
      }
      await prisma.productImage.deleteMany({ where: { id: { in: dupIds } } });
      markFixed("c3", "fotos repetidas borradas", dupIds.length);
      p.images = p.images.filter((i) => !gone.has(i.id));
    }
  }
  const byColor = new Map<string, number>();
  for (const img of p.images) if (img.color) byColor.set(img.color, (byColor.get(img.color) ?? 0) + 1);
  for (const [color, n] of byColor) {
    if (n > 1) flag("c3", sup, "varias fotos distintas del mismo color (¿vistas o duplicado?)", `${label} "${color}" ×${n}`);
  }

  // ---- C5 colores sin foto (solo en productos con galería por color) ----
  const imageColors = new Set(p.images.map((i) => i.color).filter((c): c is string => !!c));
  if (imageColors.size > 0) {
    const missing = variantColors.filter((c) => !imageColors.has(c));
    if (missing.length) flag("c5", sup, "colores de variante sin foto propia", `${label} → ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`);
  }

  // ---- C8 precios ----
  const base = parseFloat(p.basePrice.toString());
  if (!(base > 0)) flag("c8", sup, "precio base a cero o negativo", label);
  else if (base > 250) flag("c8", sup, "precio base alto (>250 €)", `${label} ${base.toFixed(2)} €`);
  const prices = p.variants.map((v) => parseFloat(v.price.toString()));
  const zeroVariants = prices.filter((x) => !(x > 0)).length;
  if (zeroVariants > 0) flag("c8", sup, "variantes con precio a cero", `${label} (${zeroVariants}/${prices.length})`);
  const pos = prices.filter((x) => x > 0);
  if (pos.length > 1 && Math.max(...pos) / Math.min(...pos) >= 4)
    flag("c8", sup, "variantes con precios muy dispares (×4 o más)", `${label} ${Math.min(...pos).toFixed(2)}–${Math.max(...pos).toFixed(2)} €`);
}

async function main() {
  console.log(`${FIX ? "MODO --fix (escribe en BD)" : "Solo informe (sin escribir)"}\n`);
  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const page = await prisma.product.findMany({
      where: { stock: { gt: 0 } },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        supplierSku: true,
        supplier: { select: { name: true } },
        variants: { select: { id: true, size: true, color: true, price: true, stock: true } },
        images: { select: { id: true, url: true, color: true, position: true } },
      },
    });
    if (page.length === 0) break;
    for (const p of page) await auditProduct(p);
    total += page.length;
    cursor = page[page.length - 1].id;
    console.log(`  ${total} productos revisados...`);
  }

  for (const [, list] of namesSeen) {
    const distinct = new Set(list.map((x) => `${x.supplier}|${x.sku}`));
    if (distinct.size > 1) {
      for (const x of list) flag("c7", x.supplier, "nombre idéntico a otro producto", `${x.sku} (${list.length} con el mismo nombre)`);
    }
  }

  const lines: string[] = [];
  lines.push(`# Auditoría de calidad de datos — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  lines.push(`Modo: ${FIX ? "con arreglos automáticos aplicados" : "solo informe"} · productos visibles revisados: ${total}`);
  lines.push(`Por proveedor: ${[...scannedBySupplier].map(([s, n]) => `${s} ${n}`).join(" · ")}\n`);

  for (const id of Object.keys(CONTROLS) as ControlId[]) {
    const rows = [...findings].filter(([k]) => k.startsWith(`${id}|`));
    const totalCases = rows.reduce((s, [, c]) => s + c.count, 0);
    lines.push(`## ${id.toUpperCase()} · ${CONTROLS[id]} — ${totalCases} casos`);
    if (rows.length === 0) lines.push("Sin incidencias.");
    for (const [k, c] of rows.sort((a, b) => b[1].count - a[1].count)) {
      const [, sup, kind] = k.split("|");
      lines.push(`- **${sup}** · ${kind}: ${c.count}`);
      for (const ex of c.examples) lines.push(`    - ${ex}`);
    }
    const fx = [...fixed].filter(([k]) => k.startsWith(`${id}|`));
    for (const [k, n] of fx) lines.push(`- ARREGLADO: ${k.split("|")[1]}: ${n}`);
    lines.push("");
  }

  const text = lines.join("\n");
  console.log("\n" + text);
  if (OUT) writeFileSync(OUT, text, "utf8");
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
