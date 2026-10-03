import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { slugify, type Product, type ProductDetail } from "./product-format";
import { displayCategoryName } from "./category-display";

// Product data layer — reads from the real database (multi-supplier ready).
// One row here = one product family (e.g. "CAMISETA ALGODÓN NATUR" across
// all its colors/sizes); each family's individual color/size combinations
// live in ProductVariant (see prisma/schema.prisma).

export type { Product, ProductVariant, ProductDetail } from "./product-format";
export { slugify, describeEngravingTechnique } from "./product-format";

const FALLBACK_CATEGORY = "Otros artículos";
const PAGE_SIZE = 24;

// Qué se ve en la tienda (Josep, 2026-10-02): con stock, con precio real y con
// al menos una foto. Excluirlo aquí en vez de poner stock a 0 a mano — la
// siguiente sincronización de proveedor lo revertiría. Un producto a 0 €
// se podría pedir gratis; uno sin foto no se puede vender.
// Y con al menos una variante: sin variantes no hay nada que añadir al
// carrito (30 productos de Cifra estaban visibles así, 2026-10-03).
const VISIBLE = { stock: { gt: 0 }, basePrice: { gt: 0 }, images: { some: {} }, variants: { some: {} } } as const;

type DbProductWithRelations = {
  id: string;
  name: string;
  description: string | null;
  subcategory: string | null;
  brand: string | null;
  material: string | null;
  engravingTechnique: string | null;
  basePrice: { toString(): string };
  stock: number;
  supplierSku: string;
  unitsPerPack: number | null;
  unitsPerCase: number | null;
  incompleteData: boolean;
  category: { name: string } | null;
  images: { url: string }[];
};

function toProduct(p: DbProductWithRelations): Product {
  return {
    slug: slugify(`${p.name}-${p.supplierSku}`),
    name: p.name,
    description: p.description ?? "",
    category: p.category?.name ? displayCategoryName(p.category.name) : FALLBACK_CATEGORY,
    subcategory: p.subcategory ?? "",
    brand: p.brand ?? "",
    image: p.images[0]?.url ?? "",
    price: parseFloat(p.basePrice.toString()),
    stock: p.stock,
    material: p.material ?? "",
    engravingTechnique: p.engravingTechnique ?? "",
    unitsPerPack: p.unitsPerPack,
    unitsPerCase: p.unitsPerCase,
    incompleteData: p.incompleteData,
  };
}

const productInclude = {
  category: { select: { name: true } },
  images: { take: 1, orderBy: { position: "asc" as const } },
};

export async function getTopCategories(limit = 8) {
  const categories = await prisma.category.findMany({
    where: { name: { not: FALLBACK_CATEGORY }, products: { some: { ...VISIBLE } } },
    include: { _count: { select: { products: { where: { ...VISIBLE } } } } },
  });
  const top = categories
    .map((c) => ({ id: c.id, name: displayCategoryName(c.name), slug: c.slug, count: c._count.products }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const minPrices = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { categoryId: { in: top.map((c) => c.id) }, ...VISIBLE },
    _min: { basePrice: true },
  });
  const priceByCategoryId = new Map(minPrices.map((m) => [m.categoryId, m._min.basePrice ? parseFloat(m._min.basePrice.toString()) : null]));

  return top.map((c) => ({ ...c, fromPrice: priceByCategoryId.get(c.id) ?? null }));
}

export async function getCategories() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: { where: { ...VISIBLE } } } } },
  });
  return categories
    .map((c) => ({ name: displayCategoryName(c.name), slug: c.slug, count: c._count.products }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

export async function getBrands() {
  const rows = await prisma.product.groupBy({
    by: ["brand"],
    where: { ...VISIBLE, brand: { not: null } },
    _count: { _all: true },
  });
  return rows
    .filter((r) => r.brand)
    .map((r) => ({ name: r.brand as string, slug: slugify(r.brand as string), count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

// Wrapped in React's cache() so generateMetadata and the page component
// (both calling this per request) share one DB scan instead of two.
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  // Slug is derived (name + sku), not stored — scan is fine at this catalog
  // size; add a stored+indexed slug column if this ever needs to scale up.
  const products = await prisma.product.findMany({
    where: { ...VISIBLE },
    include: {
      category: { select: { name: true } },
      // La ficha de producto sí enseña todas las fotos (galería) — a
      // diferencia de productInclude (listados/tarjetas), que se queda con
      // la primera nada más por rendimiento.
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { stock: "desc" } },
    },
  });
  const match = products.find((p) => slugify(`${p.name}-${p.supplierSku}`) === slug);
  if (!match) return null;
  return {
    ...toProduct(match),
    images: match.images.map((img) => ({ url: img.url, color: img.color ?? null })),
    variants: match.variants.map((v) => ({
      id: v.id,
      size: v.size ?? "",
      color: v.color ?? "",
      price: parseFloat(v.price.toString()),
      pricePack: v.pricePack ? parseFloat(v.pricePack.toString()) : null,
      priceBox: v.priceBox ? parseFloat(v.priceBox.toString()) : null,
      stock: v.stock,
      supplierModelCode: v.supplierModelCode,
    })),
  };
});

export async function getProductsByCategorySlug(categorySlug: string, limit?: number): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { ...VISIBLE, category: { slug: categorySlug } },
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
    where: { ...VISIBLE },
    select: { name: true, supplierSku: true, lastSyncedAt: true },
  });
  return products.map((p) => ({
    slug: slugify(`${p.name}-${p.supplierSku}`),
    lastModified: p.lastSyncedAt,
  }));
}

// Fixed priority order agreed with the business (docs/todo-hero-y-catalogo-2026-09-29.md)
// — reflects real order volume/revenue, not alphabetical. "weight" only
// controls visual size in the homepage nav (1-3 bigger, 7-8 smaller).
export const OCCASION_ORDER = [
  // Ropa Laboral primero a propósito — segmento con mucho potencial de
  // ingresos (366 productos reales: alta visibilidad, calzado de
  // seguridad, EPI de marcas especializadas) que hasta hoy no tenía sitio
  // en la navegación. Petición directa del dueño, 2026-09-30: "se le tiene
  // que dar más importancia, de ahí puede salir bastante dinero".
  { slug: "ropa-laboral", name: "Ropa Laboral", weight: "lg" as const },
  { slug: "despedidas", name: "Despedidas de soltero/a", weight: "lg" as const },
  { slug: "penyas-fiestas", name: "Peñas y fiestas de pueblo", weight: "lg" as const },
  { slug: "empresas-equipos", name: "Empresas y equipos", weight: "lg" as const },
  { slug: "regalos-personalizados", name: "Regalos personalizados", weight: "md" as const },
  { slug: "navidad", name: "Navidad", weight: "md" as const },
  { slug: "equipacion-deportiva", name: "Equipación deportiva / clubs", weight: "md" as const },
  { slug: "comuniones", name: "Comuniones", weight: "sm" as const },
  { slug: "bodas", name: "Bodas", weight: "sm" as const },
];

export async function getOccasions() {
  const occasions = await prisma.occasion.findMany({
    include: { _count: { select: { products: true } } },
  });
  const bySlug = new Map(occasions.map((o) => [o.slug, o]));
  return OCCASION_ORDER.map((o) => ({
    ...o,
    count: bySlug.get(o.slug)?._count.products ?? 0,
  }));
}

// Outlet isn't a single supplier category — Cifra tags some products with
// their own "OUTLET" category and others with a plain "Outlet" subcategory
// under a different parent, so both need matching to catch the real outlet
// inventory (verified: 14 + 55 products respectively).
export async function getOutletCount() {
  return prisma.product.count({
    where: {
      ...VISIBLE,
      OR: [{ category: { slug: "outlet" } }, { subcategory: { contains: "outlet", mode: "insensitive" } }],
    },
  });
}

export type ProductSort = "relevancia" | "precio_asc" | "precio_desc" | "nombre_asc" | "nombre_desc";

const SORT_ORDER_BY: Record<ProductSort, { stock: "desc" } | { basePrice: "asc" | "desc" } | { name: "asc" | "desc" }> = {
  // No real "bestseller" data yet — highest stock first is a reasonable
  // stand-in default (mainstream staples tend to be stocked deeper than
  // niche industrial items) rather than the supplier's raw table order.
  relevancia: { stock: "desc" },
  precio_asc: { basePrice: "asc" },
  precio_desc: { basePrice: "desc" },
  nombre_asc: { name: "asc" },
  nombre_desc: { name: "desc" },
};

export async function searchProducts(opts: {
  category?: string;
  occasion?: string;
  brand?: string;
  outlet?: boolean;
  q?: string;
  page?: number;
  sort?: ProductSort;
}) {
  // outlet and q both need their own OR — combined via AND so neither
  // overwrites the other when both filters are active at once.
  const where = {
    ...VISIBLE,
    ...(opts.category ? { category: { slug: opts.category } } : {}),
    ...(opts.occasion ? { occasions: { some: { occasion: { slug: opts.occasion } } } } : {}),
    ...(opts.brand ? { brand: opts.brand } : {}),
    AND: [
      ...(opts.outlet
        ? [{ OR: [{ category: { slug: "outlet" } }, { subcategory: { contains: "outlet", mode: "insensitive" as const } }] }]
        : []),
      ...(opts.q
        ? [
            {
              // Buscar por marca también, no solo nombre/categoría — un
              // cliente que escribe "Roly" en el buscador espera ver
              // productos Roly, no solo coincidencias sueltas de letras en
              // otros nombres (bug real reportado por el dueño, 2026-10-01).
              OR: [
                { name: { contains: opts.q, mode: "insensitive" as const } },
                { brand: { contains: opts.q, mode: "insensitive" as const } },
                { category: { name: { contains: opts.q, mode: "insensitive" as const } } },
                { subcategory: { contains: opts.q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);

  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: SORT_ORDER_BY[opts.sort ?? "relevancia"],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { products: products.map(toProduct), total, page, totalPages, pageSize: PAGE_SIZE };
}
