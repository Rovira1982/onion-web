import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Image
          src={product.image}
          alt={product.name}
          fill
          unoptimized
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        {product.stock > 0 && product.stock <= 20 && (
          <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 font-display text-xs font-bold text-white">
            Últimas unidades
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="font-display text-xs font-semibold uppercase tracking-wide text-brand">
          {product.category}
        </span>
        <h3 className="line-clamp-2 font-display text-sm font-semibold text-ink">
          {product.name}
        </h3>
        <p className="mt-auto pt-2 text-sm text-ink-soft">
          Desde{" "}
          <span className="font-display text-base font-bold text-ink">
            {product.price.toFixed(2).replace(".", ",")} €
          </span>
        </p>
      </div>
    </Link>
  );
}
