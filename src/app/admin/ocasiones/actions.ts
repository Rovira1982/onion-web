"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type ProductPick = {
  id: string;
  name: string;
  supplierSku: string;
  image: string | null;
  category: string;
};

export async function buscarProductos(query: string): Promise<ProductPick[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const products = await prisma.product.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
    take: 20,
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    supplierSku: p.supplierSku,
    image: p.images[0]?.url ?? null,
    category: p.category?.name ?? "",
  }));
}

export async function asignarProducto(occasionId: string, productId: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  await prisma.productOccasion.upsert({
    where: { productId_occasionId: { productId, occasionId } },
    update: {},
    create: { productId, occasionId },
  });
  return { ok: true };
}

export async function quitarProducto(occasionId: string, productId: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  await prisma.productOccasion.delete({
    where: { productId_occasionId: { productId, occasionId } },
  });
  return { ok: true };
}
