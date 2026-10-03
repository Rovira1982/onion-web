import type { MetadataRoute } from "next";
import { getAllProductSlugsForSitemap, getCategories } from "@/lib/products";
import { isLaunched } from "@/lib/launch";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Special Next.js files (sitemap/robots) don't inherit the layout's
// `dynamic` export — needs its own, or the build tries to generate it
// statically and fails without build-time DB access.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Vacío durante la cuenta atrás de prelanzamiento — robots.ts ya manda
  // Disallow global, pero más vale no ofrecer URLs para rastrear tampoco.
  if (!isLaunched()) return [];

  const [categories, products] = await Promise.all([getCategories(), getAllProductSlugsForSitemap()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/contacto`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteUrl}/catalogo?categoria=${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/producto/${p.slug}`,
    lastModified: p.lastModified,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
