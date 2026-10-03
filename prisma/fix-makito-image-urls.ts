// Arregla un fallo real encontrado en producción, 2026-10-01:
// makito-backfill-images.ts se lanzó varias veces en local contra la
// MISMA base de datos de producción (proxy público de Railway) —
// NEXT_PUBLIC_SITE_URL en el .env.local de desarrollo apunta a
// http://localhost:3000 (correcto para navegar en local), pero las URLs
// de imagen que ese script escribía eran PERMANENTES en la base de datos
// compartida, así que las fotos activadas en local quedaron apuntando al
// portátil de quien lo lanzó en vez de a la web real — rotas para
// cualquier cliente real (visto en una captura del móvil del dueño:
// icono de imagen rota en el catálogo).
//
// Arreglo de raíz (petición del dueño, 2026-10-01: "busca otro sistema,
// porque cuando migremos a la definitiva volverá a pasar"): cualquier
// ProductImage cuya URL sea de nuestro propio /api/uploads/ — tenga el
// dominio que tenga grabado, roto o no — se normaliza a ruta relativa
// (sin protocolo ni dominio). makito-backfill-images.ts ya se cambió para
// escribir rutas relativas desde ahora; este script limpia lo que ya
// quedó grabado con un dominio absoluto, para que el día que cambiéis de
// dominio definitivo no haga falta volver a tocar nada.
//
// Run with: npx tsx prisma/fix-makito-image-urls.ts [--apply]
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "./_client";

const APPLY = process.argv.includes("--apply");


// "https://cualquier-dominio.com/api/uploads/x" -> "/api/uploads/x"
function toRelative(url: string): string {
  return url.replace(/^https?:\/\/[^/]+(\/api\/uploads\/.*)$/, "$1");
}

async function main() {
  const all = await prisma.productImage.findMany({ where: { url: { contains: "/api/uploads/" } } });
  const toFix = all.filter((img) => toRelative(img.url) !== img.url);
  console.log(`${toFix.length} imágenes de /api/uploads/ con dominio absoluto grabado (de ${all.length} totales).`);

  if (!APPLY) {
    console.log("DRY-RUN — ejemplo de cambio:", toFix[0]?.url, "->", toFix[0] ? toRelative(toFix[0].url) : "(nada que corregir)");
    console.log("Relanza con --apply para corregir de verdad.");
    await prisma.$disconnect();
    return;
  }

  let fixed = 0;
  for (const img of toFix) {
    await prisma.productImage.update({ where: { id: img.id }, data: { url: toRelative(img.url) } });
    fixed++;
    if (fixed % 500 === 0) console.log(`  ${fixed}/${toFix.length} corregidas...`);
  }
  console.log(`\nCorregidas: ${fixed} imágenes.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
