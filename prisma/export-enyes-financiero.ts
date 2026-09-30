// Export de solo lectura para Director financiero (2026-09-30) — NO toca
// la base de datos ni la web, lee la API de Enyes en vivo (igual que
// import-enyes.ts) y escribe un CSV en
// E:\onion\26\finanzas\proveedores\enyes-export.csv.
//
// Mismo formato "largo" que export-makito-financiero.ts: una fila por
// cada tramo de cada combinación — aquí la tarifa SÍ es por combinación
// (color), no por familia como en Makito, así que no hace falta repartir
// un coste único entre variantes.
//
// Run with: npx tsx prisma/export-enyes-financiero.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "fs";

const W_USU = "9976051";
const BASE_URL = "https://info.catapendix.es/cgi-vel/encender";

function sanitizeEnyesJson(text: string): string {
  return text
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
  name: Record<string, string>;
  description?: Record<string, string>;
  categories?: string[];
  combinations?: Record<string, EnyesCombination>;
};
type EnyesTarifaRow = {
  product: string;
  combinations: Record<string, { rates: Record<string, { price: number; from: number }> }>;
};

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const catalog = await fetchLatin1Json<{ products: string[] }>(`${BASE_URL}/w-catalogo.pro?W-USU=${W_USU}`);
  console.log(`Catálogo: ${catalog.products.length} familias.\n`);

  const header = [
    "modelo_raiz",
    "sku_variante",
    "nombre",
    "descripcion",
    "categorias_raw",
    "color",
    "talla",
    "ean",
    "tramo_num",
    "tramo_cantidad_minima",
    "coste_unitario",
  ];
  const rows: string[] = [header.join(",")];

  let familiesDone = 0;
  let familiesFailed = 0;

  for (const familyCode of catalog.products) {
    try {
      const [productRes, tarifaRes] = await Promise.all([
        fetchLatin1Json<{ product: Record<string, EnyesProductCore> }>(
          `${BASE_URL}/w-product.pro?W-USU=${W_USU}&w-art=${familyCode}`
        ),
        fetchLatin1Json<EnyesTarifaRow>(`${BASE_URL}/w-tarifa.pro?W-USU=${W_USU}&w-art=${familyCode}`),
      ]);
      const core = productRes.product[familyCode];
      if (!core || !core.active) {
        await sleep(150);
        continue;
      }

      const name = core.name?.["1"] || familyCode;
      const description = (core.description?.["1"] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const categorias = (core.categories ?? []).join(" ; ");
      const combinations = core.combinations && Object.keys(core.combinations).length > 0 ? core.combinations : { [familyCode]: {} };
      const tarifaByCombo = tarifaRes.combinations ?? {};

      for (const [comboCode, combo] of Object.entries(combinations)) {
        const supplierModelCode = `ENY-${familyCode}-${comboCode}`;
        const color = combo.attributes?.color ?? combo.attributes?.Color ?? "";
        const size = combo.attributes?.size ?? combo.attributes?.talla ?? combo.attributes?.Talla ?? "";
        const ean = combo.ean ?? "";
        const rates = tarifaByCombo[comboCode]?.rates;

        if (!rates || Object.keys(rates).length === 0) {
          rows.push([familyCode, supplierModelCode, name, description, categorias, color, size, ean, "", "", ""].map(csvEscape).join(","));
          continue;
        }

        for (const [tierNum, tier] of Object.entries(rates)) {
          rows.push(
            [familyCode, supplierModelCode, name, description, categorias, color, size, ean, tierNum, tier.from, tier.price]
              .map(csvEscape)
              .join(",")
          );
        }
      }

      familiesDone++;
      if (familiesDone % 200 === 0) console.log(`  ${familiesDone}/${catalog.products.length} familias...`);
    } catch (err) {
      familiesFailed++;
      console.error(`  Fallo en familia ${familyCode}:`, err instanceof Error ? err.message : err);
    }
    await sleep(150);
  }

  const outPath = "E:\\onion\\26\\finanzas\\proveedores\\enyes-export.csv";
  writeFileSync(outPath, "\uFEFF" + rows.join("\n"), "utf-8");
  console.log(`\nEscrito: ${outPath} (${rows.length - 1} filas de datos, ${familiesDone} familias, ${familiesFailed} fallos)`);
}

main().catch((err) => {
  console.error("Error generando el export:", err);
  process.exit(1);
});
