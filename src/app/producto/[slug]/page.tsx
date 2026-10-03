import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import ProductDetailClient from "@/components/ProductDetailClient";
import { getProductBySlug, getProductsByCategorySlug, slugify } from "@/lib/products";
import { getPack } from "@/lib/packs";
import JsonLd from "@/components/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const title = `${product.name} personalizado con tu logo`;
  // product.description comes straight from the supplier's CSV export (often
  // garbled: run-on sentences, stray formatting characters) — never fit for
  // a meta description, so a clean templated one is used unconditionally
  // rather than only as a fallback for the empty case.
  const description = `${product.name} en ${product.category.toLowerCase()}: personalízalo con tu logo. Presupuesto sin compromiso en menos de 24 horas.`;

  return {
    title,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      title,
      description,
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pack?: string }>;
}) {
  const { slug } = await params;
  const { pack: packCode } = await searchParams;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // El código de pack solo es válido sobre la ficha de producto que le
  // corresponde (ver src/lib/packs.ts) — en cualquier otro producto se
  // ignora y la ficha se comporta como siempre.
  const pack = getPack(packCode);
  const activePack = pack && pack.productSlug === product.slug ? pack : null;

  const categorySlug = slugify(product.category);
  const related = (await getProductsByCategorySlug(categorySlug, 8)).filter((p) => p.slug !== product.slug).slice(0, 4);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const productUrl = `${siteUrl}/producto/${product.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          url: productUrl,
          ...(product.image && { image: product.image }),
          ...(product.brand && { brand: { "@type": "Brand", name: product.brand } }),
          category: product.category,
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "EUR",
            price: product.price.toFixed(2),
            availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: siteUrl },
            { "@type": "ListItem", position: 2, name: product.category, item: `${siteUrl}/catalogo?categoria=${categorySlug}` },
            { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
          ],
        }}
      />
      <nav className="text-xs text-ink-soft" aria-label="Migas de pan">
        <Link href="/" className="hover:text-brand">
          Inicio
        </Link>{" "}
        /{" "}
        <Link href={`/catalogo?categoria=${categorySlug}`} className="hover:text-brand">
          {product.category}
        </Link>{" "}
        / <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductDetailClient product={product} pack={activePack} />
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-xl font-bold text-ink">También te puede interesar</h2>
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
