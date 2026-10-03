// One-time cleanup: Roly/Stamina's "Maestro de Artículos" mixes Catalan and
// Spanish family names, and several collide with Cifra's own category
// names for the same concept (e.g. CLAUERS vs "Llaveros"). This merges only
// the clear, unambiguous duplicates — same narrow concept, just a different
// spelling/language — reassigning their products to the canonical category
// and deleting the now-empty duplicate. Broader-vs-narrower pairs (e.g.
// "Bolsas" vs "Bolsas térmicas") are deliberately left alone: merging those
// would lose real distinctions, not just spelling.
//
// Run with: npx tsx prisma/merge-categories.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "./_client";
import { slugify } from "../src/lib/product-format";


// [sourceNames, targetName] — every sourceName gets merged into targetName.
// targetName is created if it doesn't already exist (in the same parent as
// the first source found).
const MERGES: [string[], string][] = [
  // --- Regalo Promocional ---
  [["ACCESSORIS DE VIATGE"], "Accesorios de viaje"],
  [["ACCESSORIS INFORMÀTICA"], "Accesorios informática"],
  [["AGENDES"], "Agendas, libretas y cuadernos"],
  [["LIBRETAS", "LLIBRETES"], "Agendas, libretas y cuadernos"],
  [["ALTAVEUS BLUETOOTH"], "Altavoces bluetooth"],
  [["ALFOMBRETES RATOLÍ"], "Alfombrillas ratón"],
  [["ARTICLES DE FESTA"], "Artículos fiesta"],
  [["ARTÍCULOS PARA MASCOTAS"], "Accesorios para mascotas"],
  [["AURICULARS BOTÓ"], "Auriculares botón"],
  [["BATERIES EXTERNES"], "Baterías externas"],
  [["BIDONS"], "Bidones"],
  [["BOLÍGRAFS"], "Bolígrafos"],
  [["BOSSES TÈRMIQUES"], "Bolsas térmicas"],
  [["CARREGADORS"], "Cargadores"],
  [["CLAUERS"], "Llaveros"],
  [["COBERTS"], "Cubiertos"],
  [["ESCRIPTURA"], "Escritura"],
  [["MIRALLS"], "Espejos"],
  [["ULLERES DE SOL"], "Gafas de sol"],
  [["GORRES"], "Gorras"],
  [["MEMÒRIES USB"], "Memorias USB"],
  [["METRES"], "Metros"],
  [["NAVALLES"], "Navajas"],
  [["NECESSERS"], "Neceseres"],
  [["PARAIGÜES"], "Paraguas"],
  [["PORTADOCUMENTS"], "Portadocumentos"],
  [["RELLOTGES"], "Relojes"],
  [["SALUT I BELLESA"], "Salud y belleza"],
  [["SUPORTS"], "Soportes"],
  [["TASSES"], "Tazas"],

  // --- Ropa Laboral ---
  [["Alta visibilitat"], "Alta visibilidad"],
  [["ARMILLES"], "Chalecos"],
  [["BERMUDES"], "Bermudas"],
  [["BUSSOS - MONOS"], "Buzos y monos"],
  [["CALCETAS Y CALCETINES", "MITGETES I MITJONS"], "Calcetines"],
  [["CAMISES"], "Camisas"],
  [["SAMARRETES", "CAMISETAS"], "Camisetas"],
  [["JAQUETES", "JAQUETA-CÀRDIGAN"], "Chaquetas"],
  [["CHANDALS", "XANDALLS"], "Chándals"],
  [["DAVANTALS"], "Delantales y hostelería"],
  [["ÍGNIFUGS"], "Ropa ignífuga"],
  [["PANTALONS"], "Pantalones"],
  [["PANTALONS CURTS"], "Pantalones cortos y bañadores"],
  [["PARKAS", "PARQUES"], "Cazadoras y parkas"],
  [["POLARS"], "Polares"],
  [["SOFTSHELLS"], "Softshell"],
  [["DESSUADORES"], "Sudaderas"],
  [["TEIXITS", "TEJIDOS"], "Tejidos"],
];


async function main() {
  let merged = 0;
  let productsMoved = 0;
  let skipped = 0;

  for (const [sourceNames, targetName] of MERGES) {
    for (const sourceName of sourceNames) {
      const source = await prisma.category.findUnique({ where: { slug: slugify(sourceName) } });
      if (!source) {
        console.log(`  (saltado, no existe) ${sourceName}`);
        skipped++;
        continue;
      }

      let target = await prisma.category.findUnique({ where: { slug: slugify(targetName) } });
      if (!target) {
        target = await prisma.category.create({
          data: { name: targetName, slug: slugify(targetName), parentId: source.parentId },
        });
      }
      if (target.id === source.id) continue;

      const { count } = await prisma.product.updateMany({
        where: { categoryId: source.id },
        data: { categoryId: target.id },
      });
      productsMoved += count;

      await prisma.category.delete({ where: { id: source.id } });
      console.log(`  ${sourceName} (${count} productos) -> ${targetName}`);
      merged++;
    }
  }

  console.log(`\nFusión completa: ${merged} categorías fusionadas, ${productsMoved} productos reasignados, ${skipped} saltadas (no existían).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la fusión:", err);
  process.exit(1);
});
