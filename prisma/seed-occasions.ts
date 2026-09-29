// One-time seed: creates the 8 curated "ocasión" buckets agreed with the
// business (docs/todo-hero-y-catalogo-2026-09-29.md) — this only creates the
// Occasion rows themselves. Tagging which products belong to each occasion
// is a separate, manual step (needs real curation, not a keyword guess).
//
// Run with: npx tsx prisma/seed-occasions.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Kept in sync by hand with OCCASION_ORDER in src/lib/products.ts (that file
// has a "server-only" guard, so it can't be imported from a plain tsx
// script) — only the slug/name pairs matter here, not the display weight.
const OCCASION_ORDER = [
  { slug: "despedidas", name: "Despedidas de soltero/a" },
  { slug: "penyas-fiestas", name: "Peñas y fiestas de pueblo" },
  { slug: "empresas-equipos", name: "Empresas y equipos" },
  { slug: "regalos-personalizados", name: "Regalos personalizados" },
  { slug: "navidad", name: "Navidad" },
  { slug: "equipacion-deportiva", name: "Equipación deportiva / clubs" },
  { slug: "comuniones", name: "Comuniones" },
  { slug: "bodas", name: "Bodas" },
];

async function main() {
  for (const o of OCCASION_ORDER) {
    await prisma.occasion.upsert({
      where: { slug: o.slug },
      update: { name: o.name },
      create: { slug: o.slug, name: o.name },
    });
  }
  console.log(`${OCCASION_ORDER.length} ocasiones creadas/actualizadas.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error sembrando ocasiones:", err);
  process.exit(1);
});
