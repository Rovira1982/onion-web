import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { slugify, type Product, type ProductDetail } from "./product-format";

// Product data layer — reads from the real database (multi-supplier ready).
// One row here = one product family (e.g. "CAMISETA ALGODÓN NATUR" across
// all its colors/sizes); each family's individual color/size combinations
// live in ProductVariant (see prisma/schema.prisma).

export type { Product, ProductVariant, ProductDetail } from "./product-format";
export { slugify, describeEngravingTechnique } from "./product-format";

const FALLBACK_CATEGORY = "Otros artículos";
const PAGE_SIZE = 24;

type DbProductWithRelations = {
  id: string;
  name: string;
  description: string | null;
  subcategory: string | null;
  material: string | null;
  engravingTechnique: string | null;
  basePrice: { toString(): string };
  stock: number;
  supplierSku: string;
  category: { name: string } | null;
  images: { url: string }[];
};

function toProduct(p: DbProductWithRelations): Product {
  return {
    slug: slugify(`${p.name}-${p.supplierSku}`),
    name: p.name,
    description: p.description ?? "",
    category: p.category?.name ?? FALLBACK_CATEGORY,
    subcategory: p.subcategory ?? "",
    image: p.images[0]?.url ?? "",
    price: parseFloat(p.basePrice.toString()),
    stock: p.stock,
    material: p.material ?? "",
    engravingTechnique: p.engravingTechnique ?? "",
  };
}

const productInclude = {
  category: { select: { name: true } },
  images: { take: 1, orderBy: { position: "asc" as const } },
};

export async function getTopCategories(limit = 8) {
  const categories = await prisma.category.findMany({
    where: { name: { not: FALLBACK_CATEGORY }, products: { some: { stock: { gt: 0 } } } },
    include: { _count: { select: { products: { where: { stock: { gt: 0 } } } } } },
  });
  return categories
    .map((c) => ({ name: c.name, slug: c.slug, count: c._count.products }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getCategories() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: { where: { stock: { gt: 0 } } } } } },
  });
  return categories
    .map((c) => ({ name: c.name, slug: c.slug, count: c._count.products }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

// Wrapped in React's cache() so generateMetadata and the page component
// (both calling this per request) share one DB scan instead of two.
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  // Slug is derived (name + sku), not stored — scan is fine at this catalog
  // size; add a stored+indexed slug column if this ever needs to scale up.
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    include: { ...productInclude, variants: { orderBy: { stock: "desc" } } },
  });
  const match = products.find((p) => slugify(`${p.name}-${p.supplierSku}`) === slug);
  if (!match) return null;
  return {
    ...toProduct(match),
    variants: match.variants.map((v) => ({
      id: v.id,
      size: v.size ?? "",
      color: v.color ?? "",
      price: parseFloat(v.price.toString()),
      stock: v.stock,
      supplierModelCode: v.supplierModelCode,
    })),
  };
});

export async function getProductsByCategorySlug(categorySlug: string, limit?: number): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 }, category: { slug: categorySlug } },
    include: productInclude,
    take: limit,
  });
  return products.map(toProduct);
}

// No real sales data yet — samples a spread across top categories as a
// stand-in "bestsellers" shelf until real order data is available.
export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const topCats = await getTopCategories(limit);
  const picks: Product[] = [];
  for (const cat of topCats) {
    const [product] = await getProductsByCategorySlug(cat.slug, 1);
    if (product) picks.push(product);
    if (picks.length >= limit) break;
  }
  return picks;
}

// Minimal fields for sitemap generation — avoid loading full product/image
// payloads for all ~2600 rows just to list their URLs.
export async function getAllProductSlugsForSitemap(): Promise<{ slug: string; lastModified: Date }[]> {
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    select: { name: true, supplierSku: true, lastSyncedAt: true },
  });
  return products.map((p) => ({
    slug: slugify(`${p.name}-${p.supplierSku}`),
    lastModified: p.lastSyncedAt,
  }));
}

export async function searchProducts(opts: { category?: string; q?: string; page?: number }) {
  const where = {
    stock: { gt: 0 },
    ...(opts.category ? { category: { slug: opts.category } } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" as const } },
            { category: { name: { contains: opts.q, mode: "insensitive" as const } } },
            { subcategory: { contains: opts.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);

  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { products: products.map(toProduct), total, page, totalPages, pageSize: PAGE_SIZE };
}
