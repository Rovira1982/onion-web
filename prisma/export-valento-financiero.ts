// Export de solo lectura para Director financiero (2026-09-30) — NO toca
// la base de datos ni la web. Lee el feed de Valento en directo (misma
// fuente que import-valento.ts) y escribe
// E:\onion\26\finanzas\proveedores\valento-costes-live.csv.
//
// Valento no tiene tramos de cantidad por variante (comprobado en
// directo: un único net_price por variante) — sí trae su propio
// suggested_retail_price, que ya confirmamos que es siempre net_price×2
// (comentario en import-valento.ts, 899 variantes comprobadas), así que
// net_price es coste neto de cliente, no tarifa pública.
//
// Run with: npx tsx prisma/export-valento-financiero.ts
import { config } from "dotenv";
import { csvEscape, writeCsv } from "./_util";
config({ path: ".env.local" });

const BASE_URL = process.env.VALENTO_BASE_URL ?? "https://www.valento.es/rest";
const PAGE_SIZE = 50;
const PAGE_LIMIT = 20;


async function main() {
  const header = ["article_ref", "cref", "color_ref", "size_ref", "net_price", "suggested_retail_price", "stock"];
  const rows = [header.join(",")];
  let totalVariants = 0;

  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const q = new URLSearchParams({
      key: process.env.VALENTO_KEY!,
      idioma: "es",
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    const res = await fetch(`${BASE_URL}/catalog_feed.php?${q}`);
    if (!res.ok) throw new Error(`Valento catalog_feed falló: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;

    for (const p of data.products) {
      for (const v of p.variants) {
        rows.push(
          [p.article_ref, v.cref, v.color_ref, v.size_ref, v.net_price, v.suggested_retail_price, v.stock]
            .map(csvEscape)
            .join(",")
        );
        totalVariants++;
      }
    }
    console.log(`  página ${page}/${PAGE_LIMIT} (${totalVariants} variantes)...`);
  }

  const outPath = "E:\\onion\\26\\finanzas\\proveedores\\valento-costes-live.csv";
  writeCsv(outPath, rows);
  console.log(`\nEscrito: ${outPath} (${rows.length - 1} filas)`);
}

main().catch((err) => {
  console.error("Error generando el export:", err);
  process.exit(1);
});
