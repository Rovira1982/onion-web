import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import VariantPicker from "@/components/VariantPicker";
import {
  getProductBySlug,
  getProductsByCategorySlug,
  getProductVariants,
  describeEngravingTechnique,
} from "@/lib/products";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const categorySlug = slugify(product.category);
  const related = getProductsByCategorySlug(categorySlug)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);
  const variants = getProductVariants(product.rootmodel);

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
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted">
          <Image
            src={product.image}
            alt={product.name}
            width={600}
            height={600}
            unoptimized
            className="h-full w-full object-contain p-8"
            priority
          />
        </div>

        <div>
          <span className="font-display text-xs font-semibold uppercase tracking-wide text-brand">
            {product.category}
            {product.subcategory ? ` · ${product.subcategory}` : ""}
          </span>
          <h1 className="mt-2 text-3xl font-bold text-ink">{product.name}</h1>
          <p className="mt-1 text-xs text-ink-soft">Ref. {product.model}</p>

          <p className="mt-4 text-2xl font-bold text-ink">
            Desde {product.price.toFixed(2).replace(".", ",")} €{" "}
            <span className="text-sm font-normal text-ink-soft">/ unidad, según cantidad</span>
          </p>

          <p className="mt-6 text-ink-soft">{product.description}</p>

          {variants.length > 1 && (
            <div className="mt-5">
              <VariantPicker variants={variants} currentSlug={product.slug} />
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border p-5 text-sm">
            {product.material && (
              <div>
                <dt className="font-display font-semibold text-ink-soft">Material</dt>
                <dd className="mt-1 text-ink">{product.material}</dd>
              </div>
            )}
            {variants.length <= 1 && product.color && product.color.trim() && (
              <div>
                <dt className="font-display font-semibold text-ink-soft">Color</dt>
                <dd className="mt-1 text-ink">{product.color}</dd>
              </div>
            )}
            {product.engravingTechnique && (
              <div>
                <dt className="font-display font-semibold text-ink-soft">Personalización</dt>
                <dd className="mt-1 text-ink">
                  {describeEngravingTechnique(product.engravingTechnique)}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-display font-semibold text-ink-soft">Disponibilidad</dt>
              <dd className="mt-1 text-ink">
                {product.stock > 0 ? `${product.stock} unidades en stock` : "Consultar disponibilidad"}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/contacto?producto=${encodeURIComponent(product.name)}`}
              className="cursor-pointer rounded-full bg-brand px-7 py-3 text-center font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
            >
              Pedir presupuesto de este producto
            </Link>
            <Link
              href="/catalogo"
              className="cursor-pointer rounded-full border border-border px-7 py-3 text-center font-display text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
            >
              Seguir viendo catálogo
            </Link>
          </div>
        </div>
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
