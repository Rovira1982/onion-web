// Una sola vez (2026-10-03): 29 variantes de Makito (Epika, Rauric...) tenían
// la talla pegada al color en formato "2XL"/"XXXL" ("Blanco 2XL"). El
// importador ya reconoce esos alias; esto corrige las filas actuales sin
// reimportar el catálogo entero. Quita el sufijo de talla del color y, si
// alguna foto del producto usaba ese color sucio, la realinea.
//
// Run with: npx tsx prisma/fix-makito-size-tails.ts [--apply]
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "./_client";

const APPLY = process.argv.includes("--apply");

const TAIL = /\s+(?:XXXXL|XXXL|[2-6]XL|XXL)$/i;

async function main() {
  console.log(APPLY ? "APLICANDO\n" : "DRY-RUN (usa --apply para escribir)\n");
  const variants = await prisma.productVariant.findMany({
    where: { product: { supplier: { name: "Makito" } }, color: { not: null } },
    select: { id: true, productId: true, color: true, size: true, product: { select: { name: true } } },
  });
  const dirty = variants.filter((v) => v.color && TAIL.test(v.color));
  console.log(`Variantes de Makito con talla pegada al color: ${dirty.length}`);

  let fixed = 0;
  for (const v of dirty) {
    const clean = v.color!.replace(TAIL, "").trim();
    if (!clean) continue;
    console.log(`  ${v.product.name}: "${v.color}" → "${clean}" (talla ${v.size})`);
    if (!APPLY) continue;
    await prisma.productVariant.update({ where: { id: v.id }, data: { color: clean } });
    await prisma.productImage.updateMany({ where: { productId: v.productId, color: v.color }, data: { color: clean } });
    fixed++;
  }
  console.log(APPLY ? `\nCorregidas: ${fixed}` : "\n(nada escrito)");
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
