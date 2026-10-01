// Import de Enyes (info.catapendix.es) — API B2B sencilla: auth por
// parámetro de URL (W-USU=9976051 en cada llamada, sin login/token). 4
// endpoints, ver productes/Enyes/README ENYES API ONION AND BACK.txt:
//   w-catalogo.pro            -> lista de códigos de familia (1461 hoy)
//   w-product.pro?w-art=**    -> ficha completa de la familia (nombre,
//                                descripción, categorías, combinaciones,
//                                imágenes — todo en un único idioma "1" =
//                                español)
//   w-stock.pro?w-art=**      -> stock por combinación
//   w-tarifa.pro?w-art=**     -> tarifa por tramos de cantidad, por
//                                combinación
//
// OJO — el propio documento "API Enyes FINAL.docx" del proveedor tiene el
// texto de w-stock.pro y w-tarifa.pro CAMBIADO (dice que w-stock.pro es
// precio y w-tarifa.pro es stock) — confirmado contra el README.txt Y
// contra una llamada real, 2026-09-30: w-stock.pro devuelve
// {"quantity":N} (stock) y w-tarifa.pro devuelve {"rates":[...]} (precio).
// Este import usa el README/la API real, no el docx.
//
// El servidor declara content-type text/html pero charset=iso-8859-1 y
// sirve JSON con esa codificación — Buffer.toString('latin1') decodifica
// correcto (comprobado en directo), fetch+response.text() con UTF-8 por
// defecto corrompe los acentos.
//
// Cada combinación trae su propia tarifa por tramos (rates[0] = tramo más
// bajo, "from":1) — a diferencia de Makito (un solo precio por familia),
// aquí cada variante/color puede tener su propio coste real, así que el
// precio se calcula variante a variante, no una vez por familia.
//
// Importa con stock:0 SIEMPRE en creación (igual que Makito/Anbor) —
// invisible hasta confirmar el margen con el dueño; Enyes sí trae
// imágenes públicas (sin auth, a diferencia de Makito), así que no hace
// falta una fase 2 aparte para fotos.
//
// Run with: npx tsx prisma/import-enyes.ts [--limit=25]
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const W_USU = "9976051";
const BASE_URL = "https://info.catapendix.es/cgi-vel/encender";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const delayArg = process.argv.find((a) => a.startsWith("--delay-ms="));
  return {
    limit: limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined,
    delayMs: delayArg ? parseInt(delayArg.split("=")[1], 10) : 150,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// El JSON que devuelve la API no es válido JSON estricto — comprobado en
// directo: w-stock.pro/w-tarifa.pro mandan `"product":01010101` (número
// sin comillas y con cero a la izquierda, que ni siquiera es un número
// JSON válido) en vez de `"product":"01010101"`, y algunos textos largos
// (descripciones) traen caracteres de control sin escapar que rompen
// JSON.parse. Se sanea antes de parsear en vez de fallar familia a
// familia.
function sanitizeEnyesJson(text: string): string {
  return text
    // El "product" viene sin comillas — casi siempre es numérico
    // ("01010101", con el cero a la izquierda ya quitado aquí porque un
    // JSON number no lo admite), pero al menos una familia usa un código
    // no numérico ("CAT") — se cubren ambos casos.
    .replace(/"product":\s*0*(\w+)/, '"product":"$1"')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, " ");
}

async function fetchLatin1Json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return JSON.parse(sanitizeEnyesJson(buf.toString("latin1"))) as T;
}

type EnyesCombination = { ean?: string; attributes?: Record<string, string> };
type EnyesProductCore = {
  active: number;
  price_tax_excluded: number;
  name: Record<string, string>;
  description?: Record<string, string>;
  categories?: string[];
  combinations?: Record<string, EnyesCombination>;
  images?: { url: string; legend?: Record<string, string> }[];
};
type EnyesStockRow = { product: string | number; combinations: Record<string, { quantity: number }> };
type EnyesTarifaRow = {
  product: string | number;
  combinations: Record<string, { rates: Record<string, { price: number; from: number }> }>;
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// El coste real por variante es siempre el tramo más bajo ("from":1) de su
// propia tarifa — mismo criterio que unitCostFromScales en Makito (tramo
// que aplica a pedidos pequeños). Combinaciones descatalogadas llegan con
// un único tramo a precio 0 (vistas en directo con el código prefijado
// "*") — se tratan como sin coste real (incompleteData).
export function baseCost(rates: Record<string, { price: number; from: number }> | undefined): number | null {
  if (!rates) return null;
  const tier0 = rates["0"];
  if (!tier0 || !tier0.price) return null;
  return tier0.price;
}

type CategoryNode = { id: string; translations: Record<string, string>; subcategories?: CategoryNode[] };

function loadCategoryMaps() {
  const raw = readFileSync(join(__dirname, "..", "productes", "Enyes", "Categorias.json"), "utf-8");
  const tree = JSON.parse(raw) as CategoryNode[];
  const topLevel = new Map<string, string>();
  const subLevel = new Map<string, string>();
  for (const top of tree) {
    topLevel.set(top.id, top.translations["1"]);
    for (const sub of top.subcategories ?? []) {
      subLevel.set(sub.id, sub.translations["1"]);
    }
  }
  return { topLevel, subLevel };
}

// Los códigos de categoría que trae cada producto llevan un dígito de más
// al principio respecto a los id de Categorias.json (visto en directo:
// producto trae "10104"/"1010401" para las categorías "0104"/"010401" del
// árbol) — se quita ese primer carácter antes de buscar. Se prioriza la
// subcategoría (más específica); si no hay match, se cae a la categoría
// superior; si tampoco, a "Otros artículos" (mismo fallback que Makito).
function resolveCategory(rawIds: string[] | undefined, maps: ReturnType<typeof loadCategoryMaps>): string {
  if (!rawIds || rawIds.length === 0) return "Otros artículos";
  for (const raw of rawIds) {
    const candidate = raw.length > 6 ? raw.slice(1) : raw;
    const sub = maps.subLevel.get(candidate);
    if (sub) return sub;
  }
  for (const raw of rawIds) {
    const candidate = raw.length > 4 && raw.length <= 5 ? raw.slice(1) : raw;
    const top = maps.topLevel.get(candidate);
    if (top) return top;
  }
  return "Otros artículos";
}

async function main() {
  const { limit, delayMs } = parseArgs();
  console.log(`Límite: ${limit ?? "sin límite (catálogo completo)"} · pausa entre familias: ${delayMs}ms\n`);

  const categoryMaps = loadCategoryMaps();

  const catalog = await fetchLatin1Json<{ products: string[] }>(`${BASE_URL}/w-catalogo.pro?W-USU=${W_USU}`);
  console.log(`Catálogo: ${catalog.products.length} familias.\n`);

  const families = limit ? catalog.products.slice(0, limit) : catalog.products;

  const supplier = await prisma.supplier.upsert({
    where: { name: "Enyes" },
    update: {},
    create: { name: "Enyes", adapterKey: "enyes" },
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

  // Margen ×2 — mismo criterio que Cifra/Roly/Stamina/Makito, pendiente de
  // confirmación explícita del dueño para Enyes específicamente antes de
  // activar stock real (se importa con stock:0 hasta entonces).
  const MARGEN = 2;

  let familiesWritten = 0;
  let variantsWritten = 0;
  let familiesFailed = 0;

  for (const familyCode of families) {
    try {
      const [productRes, stockRes, tarifaRes] = await Promise.all([
        fetchLatin1Json<{ product: Record<string, EnyesProductCore> }>(
          `${BASE_URL}/w-product.pro?W-USU=${W_USU}&w-art=${familyCode}`
        ),
        fetchLatin1Json<EnyesStockRow>(`${BASE_URL}/w-stock.pro?W-USU=${W_USU}&w-art=${familyCode}`),
        fetchLatin1Json<EnyesTarifaRow>(`${BASE_URL}/w-tarifa.pro?W-USU=${W_USU}&w-art=${familyCode}`),
      ]);

      const core = productRes.product[familyCode];
      if (!core || !core.active) {
        await sleep(delayMs);
        continue;
      }

      const stockByCombo = new Map(Object.entries(stockRes.combinations ?? {}).map(([k, v]) => [k, v.quantity]));
      const tarifaByCombo = tarifaRes.combinations ?? {};

      const combinations = core.combinations && Object.keys(core.combinations).length > 0 ? core.combinations : { [familyCode]: {} };
      const variantCosts = Object.keys(combinations).map((comboCode) => baseCost(tarifaByCombo[comboCode]?.rates));
      const realCosts = variantCosts.filter((c): c is number => c != null);
      const incompleteData = realCosts.length === 0;
      const minCost = realCosts.length > 0 ? Math.min(...realCosts) : null;
      const productBasePrice = minCost != null ? Math.round(minCost * MARGEN * 100) / 100 : 0;

      const categoryName = resolveCategory(core.categories, categoryMaps);
      const categoryId = await categoryIdFor(categoryName);
      const name = core.name?.["1"] || familyCode;
      const description = (core.description?.["1"] ?? "").replace(/<[^>]+>/g, " ").trim() || null;
      const mainImage = core.images?.[0]?.url ?? null;

      const product = await prisma.product.upsert({
        where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: familyCode } },
        update: {
          name,
          description,
          brand: "Enyes",
          categoryId,
          basePrice: productBasePrice,
          incompleteData,
          lastSyncedAt: new Date(),
          // stock NO se toca en el update — mismo motivo que Makito: si ya
          // se activó a mano no se vuelve a apagar en una re-ejecución.
        },
        create: {
          supplierId: supplier.id,
          supplierSku: familyCode,
          name,
          description,
          brand: "Enyes",
          categoryId,
          basePrice: productBasePrice,
          stock: 0,
          incompleteData,
        },
      });

      if (mainImage) {
        // id determinista (no uuid aleatorio) para que una re-ejecución
        // actualice la misma fila en vez de duplicar la imagen.
        await prisma.productImage.upsert({
          where: { id: `enyes-${familyCode}-main` },
          update: { url: mainImage },
          create: { id: `enyes-${familyCode}-main`, productId: product.id, url: mainImage, position: 0 },
        });
      }

      // Una foto por color (petición del dueño, 2026-10-01) — el nombre de
      // archivo de cada imagen coincide con el código de combinación (ej.
      // ".../ME17Y.jpg" -> combinación "ME17Y"), confirmado en directo; se
      // cruza contra combinations[].attributes.color para etiquetarla.
      let colorImagePosition = 1;
      for (const img of core.images ?? []) {
        if (img.url === mainImage) continue;
        const fileBase = img.url.split("/").pop()?.replace(/\.[^.]+$/, "");
        const combo = fileBase ? combinations[fileBase] : undefined;
        const color = combo?.attributes?.color ?? combo?.attributes?.Color;
        if (!color) continue;
        const id = `enyes-${familyCode}-${fileBase}`;
        await prisma.productImage.upsert({
          where: { id },
          update: { url: img.url, color },
          create: { id, productId: product.id, url: img.url, position: colorImagePosition, color },
        });
        colorImagePosition++;
      }

      for (const [comboCode, combo] of Object.entries(combinations)) {
        const realCost = baseCost(tarifaByCombo[comboCode]?.rates);
        const price = realCost != null ? Math.round(realCost * MARGEN * 100) / 100 : productBasePrice;
        const stock = stockByCombo.get(comboCode) ?? 0;
        const supplierModelCode = `ENY-${familyCode}-${comboCode}`;
        const color = combo.attributes?.color ?? combo.attributes?.Color ?? null;
        const size = combo.attributes?.size ?? combo.attributes?.talla ?? combo.attributes?.Talla ?? null;

        await prisma.productVariant.upsert({
          where: { supplierModelCode },
          update: {
            color,
            size,
            price,
            costUnit: realCost,
            productId: product.id,
            // stock tampoco se toca aquí.
          },
          create: {
            productId: product.id,
            color,
            size,
            price,
            costUnit: realCost,
            stock: 0,
            supplierModelCode,
          },
        });
        variantsWritten++;
      }

      familiesWritten++;
      if (familiesWritten % 200 === 0) {
        console.log(`  ${familiesWritten}/${families.length} familias (${variantsWritten} variantes, ${familiesFailed} fallos)...`);
      }
    } catch (err) {
      familiesFailed++;
      console.error(`  Fallo en familia ${familyCode}:`, err instanceof Error ? err.message : err);
    }

    await sleep(delayMs);
  }

  console.log(
    `\nImportación completa: ${familiesWritten} familias, ${variantsWritten} variantes (${familiesFailed} fallos) — sin foto de fase 2, pero SÍ con stock:0 hasta confirmar margen.`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la importación:", err);
  process.exit(1);
});
