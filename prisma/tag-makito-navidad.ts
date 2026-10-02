// Tags Makito products with the "Navidad" occasion, using Makito's own
// catalog data as the signal — not a keyword guess on product names.
//
// Real gap found by Josep, 2026-10-02: searching "Navidad" only surfaced 71
// products, even though Makito has its own dedicated Christmas catalog.
// Root cause: Makito's /catalog/files response gives each product a
// `categories` array of full breadcrumb paths (e.g. "Produccion > PRODUCTOS
// > Navidad > Decoración de navidad > Decoración de navidad"), and a
// product can appear under several unrelated paths at once (its normal
// category, e.g. "Tecnología y accesorios", AND a seasonal one). The main
// import (import-makito.ts) only keeps categories[0] as the product's one
// Category — any Christmas path sitting elsewhere in the array is silently
// dropped. Confirmed live: 63 products have "navid" somewhere in their
// categories[], but only 15 have it as categories[0].
//
// This only tags the Occasion (products keep whatever Category the main
// import already gave them) — safe to re-run after every Makito sync to
// pick up newly added/removed seasonal items.
//
// Run with: npx tsx prisma/tag-makito-navidad.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const BASE_URL = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/access/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.MAKITO_TEST_CLIENT_ID,
      clientSecret: process.env.MAKITO_TEST_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function main() {
  const token = await login();
  const res = await fetch(`${BASE_URL}/catalog/files?format=JSON&lang=es`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Catálogo falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { products: { ref: string; categories?: string[] }[] };

  const navidadRefs = data.products
    .filter((p) => (p.categories ?? []).some((c) => c.toLowerCase().includes("navid")))
    .map((p) => p.ref);
  console.log(`${navidadRefs.length} productos de Makito con "Navidad" en algún nivel de categoría.`);

  const supplier = await prisma.supplier.findFirst({ where: { name: "Makito" } });
  if (!supplier) throw new Error("Proveedor Makito no encontrado");

  const occasion = await prisma.occasion.upsert({
    where: { slug: "navidad" },
    update: {},
    create: { slug: "navidad", name: "Navidad" },
  });

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id, supplierSku: { in: navidadRefs } },
    select: { id: true },
  });
  console.log(`${products.length} de esos coinciden con un producto ya importado.`);

  const result = await prisma.productOccasion.createMany({
    data: products.map((p) => ({ productId: p.id, occasionId: occasion.id })),
    skipDuplicates: true,
  });
  console.log(`${result.count} vínculos nuevos creados (el resto ya estaba vinculado).`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
