// Export de solo lectura para Director financiero (2026-09-30) — NO toca
// la base de datos ni la web. Lee la API de tarifa de Cifra en directo
// (misma fuente que prisma/cifra-source.ts) y escribe TODAS las filas tal
// cual las da la API (sin el filtrado/agrupado por familia que sí hace
// cifra-source.ts para la importación a la web) en
// E:\onion\26\finanzas\proveedores\cifra-costes-live.csv.
//
// La API de Cifra no trae tramos de cantidad (a diferencia de Makito/
// Enyes) — un solo confidential_price por modelo, confirmado en directo.
//
// Run with: npx tsx prisma/export-cifra-financiero.ts
import { config } from "dotenv";
import { csvEscape, writeCsv } from "./_util";
config({ path: ".env.local" });

type CifraApiItem = {
  model: string;
  rootmodel: string;
  name: string;
  confidential_price: string; // coma decimal, ej. "0,6"
  quantity: string;
};


async function main() {
  const token = process.env.CIFRA_API_TOKEN;
  const baseUrl = process.env.CIFRA_API_BASE_URL ?? "https://api.cifrashop.com";
  if (!token) throw new Error("CIFRA_API_TOKEN no configurado en .env.local");

  const res = await fetch(`${baseUrl}/tariff/${token}/es`);
  if (!res.ok) throw new Error(`Cifra API falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as CifraApiItem[];

  console.log(`API de Cifra: ${data.length} filas.\n`);

  const header = ["modelo", "modelo_raiz", "nombre", "confidential_price", "stock"];
  const rows = [header.join(",")];
  for (const item of data) {
    rows.push(
      [item.model, item.rootmodel, item.name, item.confidential_price, item.quantity].map(csvEscape).join(",")
    );
  }

  const outPath = "E:\\onion\\26\\finanzas\\proveedores\\cifra-costes-live.csv";
  writeCsv(outPath, rows);
  console.log(`Escrito: ${outPath} (${rows.length - 1} filas)`);
}

main().catch((err) => {
  console.error("Error generando el export:", err);
  process.exit(1);
});
