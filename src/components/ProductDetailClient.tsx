"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { describeEngravingTechnique, describeMaterial, type ProductDetail } from "@/lib/product-format";
import AddToCartForm from "@/components/AddToCartForm";

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function sortSizes(sizes: string[]) {
  return sizes.slice().sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function money(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export default function ProductDetailClient({ product }: { product: ProductDetail }) {
  const { variants } = product;
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  const sizes = useMemo(
    () => sortSizes(Array.from(new Set(variants.map((v) => v.size).filter(Boolean)))),
    [variants]
  );
  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))),
    [variants]
  );

  function findVariant(size: string, color: string) {
    return (
      variants.find((v) => v.size === size && v.color === color) ??
      variants.find((v) => v.size === size) ??
      variants.find((v) => v.color === color)
    );
  }

  const hasVariants = variants.length > 1;
  const displayPrice = selected?.price ?? product.price;
  const displayStock = selected?.stock ?? product.stock;
  const displayRef = selected?.supplierModelCode;

  return (
    <div>
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-brand">
        {product.category}
        {product.subcategory ? ` · ${product.subcategory}` : ""}
      </span>
      <h1 className="mt-2 text-3xl font-bold text-ink">{product.name}</h1>
      <p className="mt-1 text-xs text-ink-soft">
        {product.brand && <span className="font-semibold text-ink">{product.brand}</span>}
        {product.brand && displayRef ? " · " : ""}
        {displayRef && `Ref. ${displayRef}`}
      </p>

      <p className="mt-4 text-2xl font-bold text-ink">
        Desde {money(displayPrice)}{" "}
        <span className="text-sm font-normal text-ink-soft">/ unidad, según cantidad</span>
      </p>

      <p className="mt-6 text-ink-soft">{product.description}</p>

      {hasVariants && (sizes.length > 1 || colors.length > 1) && (
        <div className="mt-5 grid max-w-xs gap-4 sm:grid-cols-2">
          {sizes.length > 1 && (
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink-soft">Talla</span>
              <select
                value={selected?.size}
                onChange={(e) => {
                  const next = findVariant(e.target.value, selected?.color ?? "");
                  if (next) setSelectedId(next.id);
                }}
                className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          {colors.length > 1 && (
            <label className="flex flex-col gap-2">
              <span className="font-display text-sm font-semibold text-ink-soft">Color</span>
              <select
                value={selected?.color}
                onChange={(e) => {
                  const next = findVariant(selected?.size ?? "", e.target.value);
                  if (next) setSelectedId(next.id);
                }}
                className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {colors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border p-5 text-sm">
        {product.material && (
          <div>
            <dt className="font-display font-semibold text-ink-soft">Material</dt>
            <dd className="mt-1 text-ink">{describeMaterial(product.material)}</dd>
          </div>
        )}
        {!hasVariants && selected?.color && (
          <div>
            <dt className="font-display font-semibold text-ink-soft">Color</dt>
            <dd className="mt-1 text-ink">{selected.color}</dd>
          </div>
        )}
        {product.engravingTechnique && (
          <div>
            <dt className="font-display font-semibold text-ink-soft">Personalización</dt>
            <dd className="mt-1 text-ink">{describeEngravingTechnique(product.engravingTechnique)}</dd>
          </div>
        )}
        <div>
          <dt className="font-display font-semibold text-ink-soft">Disponibilidad</dt>
          <dd className="mt-1 text-ink">
            {displayStock > 0 ? `${displayStock} unidades en stock` : "Consultar disponibilidad"}
          </dd>
        </div>
      </dl>

      {selected && (
        <AddToCartForm
          productSlug={product.slug}
          productName={product.name}
          image={product.image}
          variant={selected}
          unitsPerPack={product.unitsPerPack}
          unitsPerCase={product.unitsPerCase}
          incompleteData={product.incompleteData}
          category={product.subcategory || product.category}
        />
      )}

      <a
        href={`https://wa.me/34616114095?text=${encodeURIComponent(`Hola! Me interesa este producto: ${product.name}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-3 text-center font-display text-sm font-bold text-white transition-colors hover:brightness-95"
      >
        Pregunta por WhatsApp
      </a>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/contacto?producto=${encodeURIComponent(product.name)}`}
          className="cursor-pointer rounded-full border border-border px-7 py-3 text-center font-display text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
        >
          Prefiero pedir presupuesto por email
        </Link>
        <Link
          href="/catalogo"
          className="cursor-pointer rounded-full border border-border px-7 py-3 text-center font-display text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand"
        >
          Seguir viendo catálogo
        </Link>
      </div>
    </div>
  );
}

export function ProductImageBox({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted">
      <Image
        src={src}
        alt={alt}
        width={600}
        height={600}
        unoptimized
        className="h-full w-full object-contain p-8"
        priority
      />
    </div>
  );
}
