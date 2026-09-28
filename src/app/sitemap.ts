import type { MetadataRoute } from "next";
import { getAllProductSlugsForSitemap, getCategories } from "@/lib/products";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getAllProductSlugsForSitemap()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/presupuesto`, changeFrequency: "monthly", priority: 0.7 },
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
