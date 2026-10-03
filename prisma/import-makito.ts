// Import de Makito (apis.makito.es) — API B2B REST con auth JWT. Ver
// https://data.makito.es/apis_b2b/index.html para la referencia completa.
//
// FASE 1 de 2 (idea del dueño, 2026-09-30: cargar todo el catálogo ya, las
// fotos después). Este script solo trae catálogo + precios — nada de
// imágenes — así que son 3 llamadas a la API en total sin importar cuántos
// productos haya, sin problema de límite de peticiones. Se importa TODO
// con stock:0 a propósito, aunque Makito ya dé stock real: sin foto, el
// componente <Image> del catálogo se rompe visualmente (src vacío), así
// que nada se activa hasta que prisma/makito-backfill-images.ts (fase 2)
// descargue la foto de ese producto y en ese momento active su stock real.
//
// --limit=N restringe la importación a los primeros N productos del
// catálogo (para probar). Sin --limit, importa todo (~4600).
//
// Run with: npx tsx prisma/import-makito.ts [--limit=25] [--env=test|prod]
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "./_client";
import { cleanName, cleanDescription } from "./text-clean";
import { slugify } from "../src/lib/product-format";

const BASE_URL = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";

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
  variants?: MakitoVariant[];
};

// variant_size es un código numérico interno de Makito (ej. "102"-"107"),
// no la talla real — bug real encontrado por Josep, 2026-10-02 (producto
// SWC280/outlet Keya): la web solo guardaba "Talla única" porque el
// `size` del variante nunca se rellenaba, y la talla real se quedaba
// enterrada sin separar dentro del campo `color` (ver parseColorLabel).
//
// Primer intento (descartado): emparejar los códigos únicos del producto,
// ordenados, con la lista `sizes` del propio producto — funcionaba en
// SWC280 pero resultó ser un espejismo. Encontrado en directo, mismo día:
// "Dretius" trae sizes="XS,L,M,S,XL,XXL,3XL" (L y S puestos a mano en el
// orden equivocado por Makito) lo que intercambiaba S<->L en la web. Los
// códigos SÍ son una tabla fija GLOBAL, confirmado escaneando variant_size
// + la última palabra de variant_name en los 4.609 productos del catálogo:
// 101=XS, 102=S, 103=M, 104=L, 105=XL, 106=XXL, 107=3XL, 108=4XL, siempre,
// en cualquier producto — así que no hace falta (ni conviene) mirar el
// campo `sizes` del producto para nada.
const MAKITO_SIZE_CODE: Record<string, string> = {
  "101": "XS",
  "102": "S",
  "103": "M",
  "104": "L",
  "105": "XL",
  "106": "XXL",
  "107": "3XL",
  "108": "4XL",
};

// Makito escribe a veces la talla en el nombre de otra forma que el código
// global (la 3XL como "XXXL", la XXL como "2XL"): sin estos alias el sufijo
// no se quitaba y el color quedaba como "Amarillo XXXL" (Rauric, Epika...).
const SIZE_NAME_ALIASES: Record<string, string[]> = {
  XXL: ["XXL", "2XL"],
  "3XL": ["3XL", "XXXL"],
  "4XL": ["4XL", "XXXXL"],
};

export function sizeTailPattern(sizeLabel: string): RegExp {
  const names = SIZE_NAME_ALIASES[sizeLabel] ?? [sizeLabel];
  return new RegExp(`\\s*(?:${names.join("|")})\\s*$`, "i");
}

export function sizeLabelFor(variant: MakitoVariant): string | null {
  if (!variant.variant_size) return null;
  return MAKITO_SIZE_CODE[variant.variant_size] ?? null;
}

// variant_name trae el nombre completo descriptivo ("Sudadera Ad. -Keya-
// Swc280 Negro S") — el color real es lo que queda tras quitar el nombre
// del producto Y la talla. El intento anterior solo quitaba el nombre del
// producto con un .replace() sensible a mayúsculas (p.name="SWC280" nunca
// coincidía con el "Swc280" real dentro de variant_name), así que no
// quitaba nada y el campo `color` acababa con el texto entero sin tocar,
// talla incluida — de ahí que la web nunca viera una talla real.
function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return a.slice(0, i);
}

// Residuo real encontrado por Josep tras el arreglo principal (2026-10-02,
// ~240 de 17.725 variantes): un puñado de productos donde el nombre de
// catálogo ni siquiera aparece dentro de variant_name — "Dretius" cuyas
// variantes dicen "Dretiu" (sin la s, error tipográfico de Makito) o
// "Draco" cuyas variantes usan el nombre de la colección "Comet" en vez
// del nombre de catálogo. Para esos casos, el boilerplate compartido se
// calcula como el prefijo común de TODAS las variantes del producto (cada
// una con su propia talla ya quitada) en vez de intentar adivinar a partir
// del nombre del producto — "Sudadera Niño Comet Rosa" / "Sudadera Adulto
// Comet Marino" / ... comparten "Sudadera " como prefijo común real.
export function fallbackBoilerplate(allVariants: MakitoVariant[], sizeLabelOf: (v: MakitoVariant) => string | null): string {
  const stripped = allVariants
    .map((v) => {
      const name = v.variant_name ?? "";
      const size = sizeLabelOf(v);
      return size ? name.replace(sizeTailPattern(size), "") : name;
    })
    .filter(Boolean);
  if (stripped.length === 0) return "";
  return stripped.reduce((prefix, s) => commonPrefix(prefix, s));
}

export function parseColorLabel(
  productName: string,
  variantName: string | undefined,
  sizeLabel: string | null,
  fallbackPrefix?: string
): string | null {
  if (!variantName) return null;
  // El color siempre va DESPUÉS del nombre del modelo, nunca antes — hay
  // boilerplate variable delante ("Sudadera Ad. -Keya- ", "Sudadera Adulto
  // Keya ", etc. según el producto) que no tiene sentido intentar
  // reconocer, así que se descarta todo lo anterior al nombre en vez de
  // solo quitar la coincidencia exacta.
  const nameIdx = variantName.toLowerCase().indexOf(productName.toLowerCase());
  let label: string;
  if (nameIdx !== -1) {
    label = variantName.slice(nameIdx + productName.length);
  } else if (fallbackPrefix && variantName.toLowerCase().startsWith(fallbackPrefix.toLowerCase())) {
    label = variantName.slice(fallbackPrefix.length);
  } else {
    label = variantName;
  }
  if (sizeLabel) {
    label = label.replace(sizeTailPattern(sizeLabel), "");
  }
  label = label.replace(/\s+/g, " ").trim();
  return label || null;
}

type MakitoPriceRow = { material: string; currency: string; baseQuantity: string; scales: { quantity: string; amount: string }[] };


// Código real de Makito para stock y pedidos: ref del producto + código de
// color + talla (ej. "15246"+"003"+"000" -> "15246003000"), confirmado
// contra /stock/files en directo, 2026-09-30 — NO es variant_reference
// (ese es un código de cara al cliente tipo "5246ROJS/T" que no aparece ni
// en stock ni en el formato que espera POST /orders, ver docs). Fallback a
// variant_reference solo para el caso sintético (producto sin variantes).
export function makitoMaterialCode(productRef: string, v: MakitoVariant): string {
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
export function unitCostFromScales(row: MakitoPriceRow | undefined, baseQuantity: string): number | null {
  if (!row || row.scales.length === 0) return null;
  const base = parseFloat(baseQuantity) || 1000;
  const amount = parseFloat(row.scales[0].amount);
  if (!amount) return null;
  return amount / base;
}

async function main() {
  const { limit, env } = parseArgs();
  console.log(`Modo: ${env === "test" ? "cuenta de TEST" : "cuenta de PRODUCCIÓN"} · límite: ${limit ?? "sin límite (catálogo completo)"}\n`);

  const token = await login(env);
  console.log("Login OK.\n");

  const [catalogRes, priceRes] = await Promise.all([
    fetch(`${BASE_URL}/catalog/files?format=JSON&lang=es`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE_URL}/price-list/files?format=JSON`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const catalog = (await catalogRes.json()) as { products: MakitoProduct[] };
  const priceList = (await priceRes.json()) as { priceList: MakitoPriceRow[] };
  const priceByMaterial = new Map(priceList.priceList.map((p) => [p.material, p]));

  console.log(`Catálogo: ${catalog.products.length} productos. Precios: ${priceList.priceList.length} filas.\n`);

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

  // Margen ×2 confirmado directamente por el dueño, 2026-09-30 — mismo
  // criterio que Cifra/Roly/Stamina.
  const MARGEN = 2;

  for (const p of products) {
    const priceRow = priceByMaterial.get(p.ref);
    const realUnitCost = unitCostFromScales(priceRow, priceRow?.baseQuantity ?? "1000");
    const basePrice = realUnitCost != null ? Math.round(realUnitCost * MARGEN * 100) / 100 : 0;

    const categoryName = leafCategory(p.categories);
    const categoryId = await categoryIdFor(categoryName);

    const product = await prisma.product.upsert({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: p.ref } },
      update: {
        name: cleanName(p.name),
        description: cleanDescription(p.description ?? "") || null,
        brand: "Makito",
        categoryId,
        basePrice,
        incompleteData: realUnitCost == null,
        lastSyncedAt: new Date(),
        // stock NO se toca en el update — si la fase 2 ya activó este
        // producto (le puso foto + stock real), una re-ejecución de la
        // fase 1 no debe volver a apagarlo.
      },
      create: {
        supplierId: supplier.id,
        supplierSku: p.ref,
        name: cleanName(p.name),
        description: cleanDescription(p.description ?? "") || null,
        brand: "Makito",
        categoryId,
        basePrice,
        stock: 0,
        incompleteData: realUnitCost == null,
      },
    });

    const variants = p.variants && p.variants.length > 0 ? p.variants : [{ variant_reference: p.ref } as MakitoVariant];
    const fallbackPrefix = fallbackBoilerplate(variants, sizeLabelFor);
    for (const v of variants) {
      const materialCode = makitoMaterialCode(p.ref, v);
      const sizeLabel = sizeLabelFor(v);
      const colorLabel = parseColorLabel(p.name, v.variant_name, sizeLabel, fallbackPrefix);
      await prisma.productVariant.upsert({
        where: { supplierModelCode: materialCode },
        update: {
          color: colorLabel,
          size: sizeLabel,
          price: basePrice,
          costUnit: realUnitCost,
          productId: product.id,
          // stock tampoco se toca aquí, mismo motivo que arriba.
        },
        create: {
          productId: product.id,
          color: colorLabel,
          size: sizeLabel,
          price: basePrice,
          costUnit: realUnitCost,
          stock: 0,
          supplierModelCode: materialCode,
        },
      });
      variantsWritten++;
    }

    productsWritten++;
    if (productsWritten % 200 === 0) {
      console.log(`  ${productsWritten}/${products.length} productos (${variantsWritten} variantes)...`);
    }
  }

  console.log(`\nFase 1 completa: ${productsWritten} productos, ${variantsWritten} variantes cargados (sin foto, invisibles todavía).`);
  console.log(`Siguiente paso: npx tsx prisma/makito-backfill-images.ts para descargar fotos y activar el stock real producto a producto.`);
  await prisma.$disconnect();
}

// Solo se ejecuta si este fichero es el script lanzado — otros scripts
// (backfill de fotos, tag-makito-navidad, fix-makito-image-colors) importan
// sus helpers, y sin esta guarda cada import arrancaba una importación
// completa de 4609 productos como efecto secundario.
if (/import-makito(\.[cm]?[jt]s)?$/.test(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error("Error en la importación:", err);
    process.exit(1);
  });
}
