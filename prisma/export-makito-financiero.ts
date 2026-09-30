// Export de solo lectura para Director financiero (2026-09-30) — NO toca
// la base de datos ni la web, solo lee la API de Makito en vivo y escribe
// un CSV en E:\onion\26\finanzas\proveedores\makito-export.csv.
//
// Formato "largo": una fila por cada tramo de cada variante (no una fila
// por artículo con columnas de tramo variables), porque el nº de tramos
// varía por material — así Excel/el financiero puede pivotar como
// necesite sin huecos.
//
// Run with: npx tsx prisma/export-makito-financiero.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "fs";

const BASE_URL = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/access/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.MAKITO_TEST_CLIENT_ID,
      clientSecret: process.env.MAKITO_TEST_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

type MakitoVariant = {
  variant_reference: string;
  variant_colorcode?: string;
  variant_size?: string;
  variant_name?: string;
};
type MakitoProduct = {
  ref: string;
  name: string;
  description?: string;
  categories?: string[];
  custom_code?: string;
  ptc_units?: number | null;
  pallet_units?: number | null;
  variants?: MakitoVariant[];
};
type MakitoScale = { quantity: string; amount: string };
type MakitoPriceRow = { material: string; currency: string; baseQuantity: string; scales: MakitoScale[] };

function makitoMaterialCode(productRef: string, v: MakitoVariant): string {
  if (v.variant_colorcode != null && v.variant_size != null) {
    return `${productRef}${v.variant_colorcode}${v.variant_size}`;
  }
  return v.variant_reference;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  console.log("Modo: cuenta de TEST (misma que se usó en la Fase 1 de importación — ver aviso en el mensaje al financiero)\n");
  const token = await login();

  const [catalogRes, priceRes] = await Promise.all([
    fetch(`${BASE_URL}/catalog/files?format=JSON&lang=es`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE_URL}/price-list/files?format=JSON`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const catalog = (await catalogRes.json()) as { products: MakitoProduct[] };
  const priceListWrap = (await priceRes.json()) as { priceList: MakitoPriceRow[] };
  const priceByMaterial = new Map(priceListWrap.priceList.map((p) => [p.material, p]));

  console.log(`Catálogo: ${catalog.products.length} productos. Precios: ${priceListWrap.priceList.length} filas.\n`);

  const header = [
    "modelo_raiz",
    "sku_variante",
    "nombre",
    "descripcion",
    "categorias",
    "talla",
    "color",
    "codigo_aduanero_custom_code",
    "unidades_por_caja_ptc_units",
    "unidades_por_pallet",
    "tramo_num",
    "tramo_cantidad_minima",
    "tramo_precio_base_quantity",
    "base_quantity",
    "coste_unitario",
    "moneda",
  ];
  const rows: string[] = [header.join(",")];

  let productsWithPricing = 0;
  let productsWithoutPricing = 0;

  for (const p of catalog.products) {
    const variants = p.variants && p.variants.length > 0 ? p.variants : [{ variant_reference: p.ref } as MakitoVariant];
    const description = (p.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const categorias = (p.categories ?? []).join(" ; ");

    for (const v of variants) {
      const materialCode = makitoMaterialCode(p.ref, v);
      const priceRow = priceByMaterial.get(materialCode) ?? priceByMaterial.get(p.ref);

      if (!priceRow || priceRow.scales.length === 0) {
        rows.push(
          [
            p.ref,
            materialCode,
            p.name,
            description,
            categorias,
            v.variant_size ?? "",
            v.variant_name?.replace(p.name, "").trim() || "",
            p.custom_code ?? "",
            p.ptc_units ?? "",
            p.pallet_units ?? "",
            "",
            "",
            "",
            "",
            "",
            "",
          ]
            .map(csvEscape)
            .join(",")
        );
        continue;
      }

      const baseQuantity = parseFloat(priceRow.baseQuantity) || 1000;
      priceRow.scales.forEach((scale, idx) => {
        const amount = parseFloat(scale.amount);
        const unitCost = amount ? Math.round((amount / baseQuantity) * 10000) / 10000 : "";
        rows.push(
          [
            p.ref,
            materialCode,
            p.name,
            description,
            categorias,
            v.variant_size ?? "",
            v.variant_name?.replace(p.name, "").trim() || "",
            p.custom_code ?? "",
            p.ptc_units ?? "",
            p.pallet_units ?? "",
            idx,
            scale.quantity,
            scale.amount,
            priceRow.baseQuantity,
            unitCost,
            priceRow.currency,
          ]
            .map(csvEscape)
            .join(",")
        );
      });
      productsWithPricing++;
      continue;
    }
    if (!priceByMaterial.has(p.ref)) productsWithoutPricing++;
  }

  const outPath = "E:\\onion\\26\\finanzas\\proveedores\\makito-export.csv";
  writeFileSync(outPath, "\uFEFF" + rows.join("\n"), "utf-8");
  console.log(`Escrito: ${outPath} (${rows.length - 1} filas de datos, ${productsWithPricing} variantes con tarifa, ${productsWithoutPricing} productos sin fila de precio propia)`);
}

main().catch((err) => {
  console.error("Error generando el export:", err);
  process.exit(1);
});
