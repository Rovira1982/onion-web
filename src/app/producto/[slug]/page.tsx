import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import ProductDetailClient, { ProductImageBox } from "@/components/ProductDetailClient";
import { getProductBySlug, getProductsByCategorySlug, slugify } from "@/lib/products";

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
    openGraph: {
      title,
      description,
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const categorySlug = slugify(product.category);
  const related = (await getProductsByCategorySlug(categorySlug, 8)).filter((p) => p.slug !== product.slug).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
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
        <ProductImageBox src={product.image} alt={product.name} />
        <ProductDetailClient product={product} />
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
