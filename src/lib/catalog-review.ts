import "server-only";
import { prisma } from "./db";
import { requireAdmin } from "./auth";

export type ReviewRow = {
  id: string;
  name: string;
  sku: string;
  supplier: string;
  stock: number;
  price: number;
};

export type ReviewSection = { total: number; rows: ReviewRow[] };

const LIMIT = 200;

// Productos con stock que la tienda NO enseña (o enseñaría rotos) y por qué —
// el mismo criterio que VISIBLE en products.ts: sin foto, a 0 € o sin
// variantes. Vuelven solos a la tienda en cuanto el proveedor manda el dato.
export async function getCatalogReview(): Promise<{
  sinFoto: ReviewSection;
  aCero: ReviewSection;
  sinVariantes: ReviewSection;
}> {
  await requireAdmin();
  const select = {
    id: true,
    name: true,
    supplierSku: true,
    stock: true,
    basePrice: true,
    supplier: { select: { name: true } },
  } as const;

  async function section(extra: Record<string, unknown>): Promise<ReviewSection> {
    const where = { stock: { gt: 0 }, ...extra };
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({ where, select, orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }], take: LIMIT }),
    ]);
    return {
      total,
      rows: rows.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.supplierSku,
        supplier: p.supplier.name,
        stock: p.stock,
        price: parseFloat(p.basePrice.toString()),
      })),
    };
  }

  const [sinFoto, aCero, sinVariantes] = await Promise.all([
    section({ images: { none: {} } }),
    section({ basePrice: { lte: 0 } }),
    section({ variants: { none: {} } }),
  ]);
  return { sinFoto, aCero, sinVariantes };
}
