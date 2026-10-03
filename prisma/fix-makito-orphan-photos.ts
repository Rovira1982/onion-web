// Una sola vez (2026-10-03): ~680 productos de Makito de una sola variante sin
// color tienen, además de su foto general, una "foto de color" sobrante cuyo
// nombre es el texto del producto ("Peluche", "Bolso"...) y que no casa con
// ninguna variante. Es una copia de la foto general (la creó el backfill
// antiguo): se borra si el producto ya tiene foto general; si no la tiene, se
// convierte en general (color null) para no dejarlo sin foto.
//
// Alcance acotado (Guardian): solo filas con id "makito-…" y url bajo
// /api/uploads/makito/; nunca toca R2; registra cada fila antes de borrarla.
//
// Run with: npx tsx prisma/fix-makito-orphan-photos.ts [--apply]
import { appendFileSync } from "node:fs";
import { prisma } from "./_client";

const APPLY = process.argv.includes("--apply");
const MAKITO_URL_PREFIX = "/api/uploads/makito/";
const LOG_FILE = `fix-makito-orphan-photos-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

async function main() {
  console.log(APPLY ? "APLICANDO\n" : "DRY-RUN (usa --apply para escribir)\n");
  const products = await prisma.product.findMany({
    where: { supplier: { name: "Makito" } },
    select: {
      id: true,
      variants: { select: { color: true } },
      images: { select: { id: true, url: true, color: true, position: true }, orderBy: { position: "asc" } },
    },
  });

  let toDelete = 0;
  let toGeneric = 0;
  for (const p of products) {
    const valid = new Set(p.variants.map((v) => v.color).filter((c): c is string => !!c));
    const orphans = p.images.filter(
      (i) => i.color && !valid.has(i.color) && i.id.startsWith("makito-") && i.url.startsWith(MAKITO_URL_PREFIX)
    );
    if (orphans.length === 0) continue;
    const hasGeneral = p.images.some((i) => !i.color);

    if (hasGeneral) {
      toDelete += orphans.length;
      if (APPLY) {
        const rows = await prisma.productImage.findMany({ where: { id: { in: orphans.map((o) => o.id) } } });
        for (const row of rows) appendFileSync(LOG_FILE, JSON.stringify({ action: "delete", row }) + "\n");
        await prisma.productImage.deleteMany({
          where: { id: { in: orphans.map((o) => o.id), startsWith: "makito-" }, url: { startsWith: MAKITO_URL_PREFIX } },
        });
      }
    } else {
      // Sin foto general: la primera huérfana pasa a ser la general, el resto sobra.
      const [first, ...rest] = orphans;
      toGeneric++;
      toDelete += rest.length;
      if (APPLY) {
        appendFileSync(LOG_FILE, JSON.stringify({ action: "to-generic", id: first.id, color: first.color }) + "\n");
        await prisma.productImage.update({ where: { id: first.id }, data: { color: null } });
        if (rest.length) {
          const rows = await prisma.productImage.findMany({ where: { id: { in: rest.map((o) => o.id) } } });
          for (const row of rows) appendFileSync(LOG_FILE, JSON.stringify({ action: "delete", row }) + "\n");
          await prisma.productImage.deleteMany({
            where: { id: { in: rest.map((o) => o.id), startsWith: "makito-" }, url: { startsWith: MAKITO_URL_PREFIX } },
          });
        }
      }
    }
  }

  console.log(`Fotos sobrantes a borrar: ${toDelete}`);
  console.log(`Productos cuya única foto huérfana pasa a general: ${toGeneric}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
