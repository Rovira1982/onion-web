"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { describeEngravingTechnique, describeMaterial, parseOnlineTechniques, type ProductDetail } from "@/lib/product-format";
import AddToCartForm, { isGarmentCategory } from "@/components/AddToCartForm";
import PackAddToCartForm from "@/components/PackAddToCartForm";
import SimpleMarkingAddToCartForm from "@/components/SimpleMarkingAddToCartForm";
import { type PackDefinition } from "@/lib/packs";

function money(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export default function ProductDetailClient({
  product,
  pack,
}: {
  product: ProductDetail;
  pack?: PackDefinition | null;
}) {
  const { variants } = product;
  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))),
    [variants]
  );
  const [selectedColor, setSelectedColor] = useState(variants[0]?.color ?? "");

  // Todas las tallas del color elegido — AddToCartForm deja pedir varias a
  // la vez, así que la talla ya no se elige aquí (ver AddToCartForm).
  const variantsForColor = useMemo(
    () => (selectedColor ? variants.filter((v) => v.color === selectedColor) : variants),
    [variants, selectedColor]
  );
  const selected = variantsForColor[0] ?? variants[0];

  const hasVariants = variants.length > 1;
  const displayPrice = selected?.price ?? product.price;
  const displayStock = variantsForColor.reduce((sum, v) => sum + v.stock, 0) || product.stock;
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

      {hasVariants && colors.length > 1 && (
        <div className="mt-5">
          <span className="font-display text-sm font-semibold text-ink-soft">Color: {selectedColor}</span>
          {/* Pastillas tocables en vez de desplegable — el color se elige
              directamente, sin abrir un <select> (petición del dueño,
              2026-09-30). */}
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                aria-pressed={selectedColor === c}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedColor === c
                    ? "border-brand bg-brand text-white"
                    : "border-border text-ink hover:border-brand hover:text-brand"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
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

      {variantsForColor.length > 0 && pack && (
        <PackAddToCartForm
          productSlug={product.slug}
          productName={product.name}
          image={product.image}
          variants={variantsForColor}
          pack={pack}
        />
      )}

      {variantsForColor.length > 0 &&
        !pack &&
        (() => {
          const category = product.subcategory || product.category;
          const onlineTechniques = parseOnlineTechniques(product.engravingTechnique);
          // Prendas de torso: configurador completo con maniquí (ver
          // AddToCartForm). Todo lo demás cuyo proveedor SÍ confirme una
          // técnica que sabemos calcular (bolsas, tazas...): versión sin
          // maniquí (petición del dueño, 2026-09-30 — antes esto siempre
          // mandaba a "pide presupuesto por email" aunque el proveedor
          // tuviera marcaje disponible). Sin ninguna de las dos: se queda
          // igual que antes (solo stock + enlace de presupuesto).
          if (isGarmentCategory(category)) {
            return (
              <AddToCartForm
                productSlug={product.slug}
                productName={product.name}
                image={product.image}
                variants={variantsForColor}
                unitsPerPack={product.unitsPerPack}
                unitsPerCase={product.unitsPerCase}
                incompleteData={product.incompleteData}
                category={category}
              />
            );
          }
          if (onlineTechniques.length > 0) {
            return (
              <SimpleMarkingAddToCartForm
                productSlug={product.slug}
                productName={product.name}
                image={product.image}
                variants={variantsForColor}
                unitsPerPack={product.unitsPerPack}
                unitsPerCase={product.unitsPerCase}
                incompleteData={product.incompleteData}
                availableTechniques={onlineTechniques}
              />
            );
          }
          return (
            <AddToCartForm
              productSlug={product.slug}
              productName={product.name}
              image={product.image}
              variants={variantsForColor}
              unitsPerPack={product.unitsPerPack}
              unitsPerCase={product.unitsPerCase}
              incompleteData={product.incompleteData}
              category={category}
            />
          );
        })()}

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

export function ProductImageBox({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const src = images[selected] ?? images[0] ?? "";

  return (
    <div>
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
      {/* Varias fotos por producto (Cifra/Makito suelen traer varias
          ángulos/colores) — antes solo se enseñaba la primera (petición
          del dueño, 2026-09-30). */}
      {images.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
              aria-label={`Foto ${i + 1} de ${alt}`}
              className={`h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border bg-white transition-colors ${
                selected === i ? "border-brand" : "border-border hover:border-brand"
              }`}
            >
              <Image src={img} alt="" width={64} height={64} unoptimized className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
