// Una sola vez (2026-10-02): el backfill de fotos de Makito derivaba el
// color con el .replace(p.name, ...) roto de la fase 1, así que creó UNA
// foto "por color" por cada TALLA (color sucio, p.ej. "Swc280 Negro S") y
// la galería de la web enseñaba cada foto repetida N veces — y al elegir un
// color nunca saltaba a su foto, porque ProductImage.color no coincidía con
// ProductVariant.color (ya limpio tras el arreglo de import-makito.ts).
//
// No descarga nada: reasigna cada foto huérfana a su color limpio usando el
// catálogo de Makito (una sola petición) para saber qué color sucio
// corresponde a cuál limpio, deja UNA foto por color y borra el resto.
//
// Run with: npx tsx prisma/fix-makito-image-colors.ts [--apply] [--env=test|prod]
import { config } from "dotenv";
config({ path: ".env.local" });

import { appendFileSync } from "node:fs";
import { prisma } from "./_client";
import { fallbackBoilerplate, parseColorLabel, sizeLabelFor } from "./import-makito";

const MAKITO_URL_PREFIX = "/api/uploads/makito/";
const LOG_FILE = `fix-makito-image-colors-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

const BASE_URL = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";

const APPLY = process.argv.includes("--apply");
const env = (process.argv.find((a) => a.startsWith("--env="))?.split("=")[1] as "test" | "prod") ?? "test";

type MakitoVariant = { variant_reference: string; variant_name?: string; variant_size?: string };
type MakitoProduct = { ref: string; name: string; variants?: MakitoVariant[] };

async function login(): Promise<string> {
  const clientId = env === "test" ? process.env.MAKITO_TEST_CLIENT_ID : process.env.MAKITO_CLIENT_ID;
  const clientSecret = env === "test" ? process.env.MAKITO_TEST_CLIENT_SECRET : process.env.MAKITO_CLIENT_SECRET;
  const res = await fetch(`${BASE_URL}/access/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { token: string }).token;
}

async function main() {
  console.log(`${APPLY ? "APLICANDO" : "DRY-RUN (usa --apply para escribir)"} · cuenta ${env}\n`);
  const token = await login();
  const res = await fetch(`${BASE_URL}/catalog/files?format=JSON&lang=es`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Catálogo falló: ${res.status}`);
  const catalog = (await res.json()) as { products: MakitoProduct[] };

  const supplier = await prisma.supplier.findUnique({ where: { name: "Makito" } });
  if (!supplier) throw new Error('Proveedor "Makito" no encontrado');

  let productsFixed = 0;
  let renamed = 0;
  let deleted = 0;
  let unresolved = 0;

  for (const p of catalog.products) {
    const db = await prisma.product.findUnique({
      where: { supplierId_supplierSku: { supplierId: supplier.id, supplierSku: p.ref } },
      select: {
        id: true,
        variants: { select: { color: true } },
        images: { select: { id: true, url: true, color: true, position: true }, orderBy: { position: "asc" } },
      },
    });
    if (!db) continue;

    const validColors = new Set(db.variants.map((v) => v.color).filter((c): c is string => !!c));
    // Alcance acotado a propósito (Guardian, 2026-10-02): solo filas de foto
    // de Makito — id "makito-…" Y url bajo /api/uploads/makito/. Nunca
    // logos/ ni logos-archivo/ (archivos de clientes). Además este script no
    // hace NINGUNA llamada a R2: solo renombra/borra filas de product_images.
    const orphans = db.images.filter(
      (img) =>
        img.color &&
        !validColors.has(img.color) &&
        img.id.startsWith("makito-") &&
        img.url.startsWith(MAKITO_URL_PREFIX)
    );
    if (orphans.length === 0) continue;

    const variants = p.variants ?? [];
    const fallbackPrefix = fallbackBoilerplate(variants, sizeLabelFor);
    const dirtyToClean = new Map<string, string>();
    for (const v of variants) {
      const dirty = v.variant_name?.replace(p.name, "").trim();
      const clean = parseColorLabel(p.name, v.variant_name, sizeLabelFor(v), fallbackPrefix);
      if (dirty && clean) dirtyToClean.set(dirty, clean);
    }

    const cleanHasImage = new Set(db.images.filter((i) => i.color && validColors.has(i.color)).map((i) => i.color!));
    const toDelete: string[] = [];
    const toRename: { id: string; newId: string; color: string }[] = [];

    for (const img of orphans) {
      const clean = dirtyToClean.get(img.color!);
      if (!clean || !validColors.has(clean)) {
        unresolved++;
        continue;
      }
      if (cleanHasImage.has(clean)) {
        toDelete.push(img.id);
      } else {
        toRename.push({ id: img.id, newId: `makito-${p.ref}-${clean}`, color: clean });
        cleanHasImage.add(clean);
      }
    }

    if (toDelete.length || toRename.length) productsFixed++;
    renamed += toRename.length;
    deleted += toDelete.length;

    if (APPLY) {
      if (toDelete.length) {
        // Registro ANTES de borrar, fila completa — permite restaurar.
        const rows = await prisma.productImage.findMany({ where: { id: { in: toDelete } } });
        for (const row of rows) appendFileSync(LOG_FILE, JSON.stringify({ action: "delete", row }) + "\n");
        await prisma.productImage.deleteMany({
          where: { id: { in: toDelete, startsWith: "makito-" }, url: { startsWith: MAKITO_URL_PREFIX } },
        });
      }
      for (const r of toRename) {
        appendFileSync(LOG_FILE, JSON.stringify({ action: "rename", ...r }) + "\n");
        await prisma.productImage.update({ where: { id: r.id }, data: { id: r.newId, color: r.color } });
      }
    }
  }

  console.log(`Productos tocados: ${productsFixed}`);
  console.log(`Fotos reasignadas a su color limpio: ${renamed}`);
  console.log(`Fotos duplicadas borradas: ${deleted}`);
  console.log(`Fotos huérfanas sin resolver (se dejan): ${unresolved}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
