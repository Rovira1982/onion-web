import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import { getTopCategories, getFeaturedProducts, getOccasions, getOutletCount } from "@/lib/products";
import { getActivePromotion } from "@/lib/promotions";
import { getVisiblePacks } from "@/lib/packs";

const OCCASION_CARD_STYLE = {
  lg: "sm:col-span-2 py-8 text-lg",
  md: "py-6 text-base",
  sm: "py-4 text-sm opacity-80",
} as const;

const TRUST_BADGES = [
  {
    title: "Sin sorpresas, nunca",
    text: "Si algo falla, te devolvemos el importe o repetimos tu pedido.",
  },
  {
    title: "Entrega siempre en fecha",
    text: "Nos comprometemos por escrito a que tu pedido llegue a tiempo.",
  },
  {
    title: "Envío gratuito",
    text: "Sin gastos de transporte a partir de 300 € (IVA incluido).",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Cuéntanos qué necesitas",
    text: "Presupuesto, cantidad y tu logo. Te respondemos con opciones en menos de 24 horas.",
  },
  {
    step: "2",
    title: "Aprueba la muestra digital",
    text: "Te enviamos una previsualización con tu logo antes de fabricar nada.",
  },
  {
    step: "3",
    title: "Recibe tu pedido a tiempo",
    text: "Fabricación, personalización y envío, con la fecha de entrega comprometida por escrito.",
  },
];

export default async function Home() {
  const categories = await getTopCategories(8);
  const bestsellers = await getFeaturedProducts(8);
  const promotion = await getActivePromotion();
  const occasions = await getOccasions();
  const outletCount = await getOutletCount();
  const ropaLaboral = occasions.find((o) => o.slug === "ropa-laboral");
  const visiblePacks = getVisiblePacks();

  return (
    <>
      {/* Hero — en móvil: foto a sangre primero, luego titular + frase + 2
          botones en el primer pantallazo y la prueba social debajo (muestra B
          de Diseño, elegida por Josep 2026-10-03). Buscador secundario. */}
      <section className="relative overflow-hidden bg-background lg:bg-brand-light">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-8 lg:py-24 lg:pb-24">
          <div className="relative order-first -mx-4 sm:mx-auto sm:w-full sm:max-w-md lg:order-last">
            <div className="absolute -inset-6 -z-10 hidden rounded-[2.5rem] bg-brand/10 blur-2xl sm:block" aria-hidden="true" />
            <div className="overflow-hidden sm:rounded-[2rem] sm:border sm:border-border sm:bg-white sm:shadow-xl">
              <Image
                src="/social-proof/asevi-detalle-real.jpg"
                alt="Detalle personalizado real entregado a @asevi.es"
                width={800}
                height={1000}
                priority
                className="h-[220px] w-full object-cover sm:h-[480px]"
              />
            </div>
            <p className="mt-3 hidden text-center text-xs text-ink-soft sm:block">
              Pedido real entregado a <span className="font-semibold text-ink">@asevi.es</span>
            </p>
          </div>

          <div>
            <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink sm:text-5xl">
              Tú pones la idea y <span className="text-brand">nosotros el cariño.</span>
            </h1>
            <p className="mt-3 max-w-xl text-base text-ink-soft sm:text-lg">
              Camisetas, sudaderas y más con tu logo o tu idea, hechas en nuestro taller.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/presupuesto"
                className="rounded-full bg-ink px-6 py-3.5 text-center font-display text-base font-bold text-white transition-colors hover:bg-ink/90"
              >
                Diseña la tuya
              </Link>
              <Link
                href="/catalogo"
                className="rounded-full border-2 border-ink px-6 py-3 text-center font-display text-base font-bold text-ink transition-colors hover:bg-ink hover:text-white"
              >
                Ver catálogo
              </Link>
            </div>

            <p className="mt-6 flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink-soft">
              <span className="text-brand" aria-hidden="true">★★★★★</span>
              5,0/5 en Facebook (13 reseñas) · +2.500 seguidores · +570 en Instagram
            </p>

            <form
              action="/catalogo"
              className="mt-6 hidden max-w-lg gap-2 rounded-2xl sm:flex border border-border bg-white p-2 shadow-sm"
            >
              <label htmlFor="q" className="sr-only">
                ¿Qué quieres regalar?
              </label>
              <input
                id="q"
                name="q"
                type="text"
                placeholder="¿Qué buscas? Ej. botellas, camisetas…"
                className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="submit"
                className="cursor-pointer rounded-xl bg-brand px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Buscar
              </button>
            </form>

            {/* Se repiten en la sección "Garantía" más abajo — ocultos en
                móvil para no alargar el hero. */}
            <div className="mt-10 hidden gap-6 sm:grid sm:grid-cols-3">
              {TRUST_BADGES.map((b) => (
                <div key={b.title}>
                  <p className="font-display text-sm font-bold text-ink">{b.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Outlet — palanca de conversión, casi lo primero tras el hero (decisión
          del dueño: es lo que más engancha, y en móvil hay que llegar antes
          a algo "real" que el listado de ocasiones). */}
      {outletCount > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <Link
            href="/catalogo?outlet=1"
            className="flex items-center justify-between gap-4 rounded-2xl bg-ink px-6 py-5 text-white transition-colors hover:bg-ink/90 sm:px-8"
          >
            <div>
              <span className="font-display text-xs font-bold uppercase tracking-wide text-white/70">
                Outlet
              </span>
              <p className="mt-1 font-display text-lg font-bold sm:text-xl">
                {outletCount} productos con precio rebajado
              </p>
            </div>
            <span className="shrink-0 font-display text-sm font-bold underline underline-offset-4">
              Ver ofertas →
            </span>
          </Link>
        </section>
      )}

      {/* Ropa Laboral — banner propio, mismo nivel de protagonismo que
          Outlet: segmento con mucho potencial de ingresos que hasta hoy no
          tenía sitio en la navegación (petición del dueño, 2026-09-30). */}
      {ropaLaboral && ropaLaboral.count > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Link
            href="/catalogo?ocasion=ropa-laboral"
            className="flex items-center justify-between gap-4 rounded-2xl bg-brand px-6 py-5 text-white transition-colors hover:bg-brand-dark sm:px-8"
          >
            <div>
              <span className="font-display text-xs font-bold uppercase tracking-wide text-white/70">
                Ropa Laboral
              </span>
              <p className="mt-1 font-display text-lg font-bold sm:text-xl">
                Alta visibilidad, calzado de seguridad y EPI — {ropaLaboral.count} productos
              </p>
            </div>
            <span className="shrink-0 font-display text-sm font-bold underline underline-offset-4">
              Ver catálogo →
            </span>
          </Link>
        </section>
      )}

      {/* Packs — precio cerrado para anuncios (destapado por el dueño,
          2026-10-01), mismo nivel de protagonismo que Outlet/Ropa Laboral. */}
      {visiblePacks.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Link
            href="/packs"
            className="flex items-center justify-between gap-4 rounded-2xl bg-brand-dark px-6 py-5 text-white transition-colors hover:bg-brand-dark/90 sm:px-8"
          >
            <div>
              <span className="font-display text-xs font-bold uppercase tracking-wide text-white/70">
                Packs
              </span>
              <p className="mt-1 font-display text-lg font-bold sm:text-xl">
                Precio cerrado con tu logo, sin sorpresas
              </p>
            </div>
            <span className="shrink-0 font-display text-sm font-bold underline underline-offset-4">
              Ver packs →
            </span>
          </Link>
        </section>
      )}

      {/* Destacados — sube justo después del outlet para que en móvil se
          vean productos reales (camisetas, etc.) sin tener que bajar por
          ocasiones/promoción/categorías primero. */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">
              Descubre nuestro catálogo
            </h2>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Una muestra de nuestras categorías con más variedad de artículos personalizables.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="hidden shrink-0 font-display text-sm font-bold text-brand hover:text-brand-dark sm:block"
          >
            Ver catálogo completo →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {bestsellers.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
        <Link
          href="/catalogo"
          className="mt-8 block text-center font-display text-sm font-bold text-brand hover:text-brand-dark sm:hidden"
        >
          Ver catálogo completo →
        </Link>
      </section>

      {/* Ocasiones — orden y peso visual fijados por el negocio, no alfabético */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">
          ¿Para qué lo necesitas?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {occasions.map((o) => (
            <Link
              key={o.slug}
              href={`/catalogo?ocasion=${o.slug}`}
              className={`flex items-center justify-center rounded-2xl border border-border bg-white px-4 text-center font-display font-bold text-ink transition-colors hover:border-brand hover:text-brand ${OCCASION_CARD_STYLE[o.weight]}`}
            >
              {o.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Promoción de temporada */}
      {promotion && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 overflow-hidden rounded-3xl border border-border bg-brand-light sm:grid-cols-2 sm:items-center">
            <div className="p-8 sm:p-10">
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">{promotion.title}</h2>
              {promotion.subtitle && <p className="mt-3 max-w-md text-ink-soft">{promotion.subtitle}</p>}
              <Link
                href={promotion.linkUrl}
                className="mt-6 inline-flex cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                {promotion.ctaLabel}
              </Link>
            </div>
            {promotion.imageUrl && (
              <div className="aspect-square sm:aspect-auto sm:h-full">
                <Image
                  src={promotion.imageUrl}
                  alt={promotion.title}
                  width={600}
                  height={600}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Encuentra el regalo perfecto */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-ink px-6 py-10 text-white sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">Encuentra el regalo perfecto</h2>
          <p className="mt-2 max-w-2xl text-white/70">
            Dinos tu presupuesto y cuántas unidades necesitas, y te proponemos las mejores opciones.
          </p>
          <form action="/catalogo" className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-2">
              <span className="font-display text-xs font-semibold uppercase tracking-wide text-white/60">
                ¿Qué quieres gastarte por regalo?
              </span>
              <select
                name="presupuesto"
                className="rounded-xl border-0 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option className="text-ink">Entre 1 € y 3 €</option>
                <option className="text-ink">Entre 3 € y 6 €</option>
                <option className="text-ink">Entre 6 € y 12 €</option>
                <option className="text-ink">Más de 12 €</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-display text-xs font-semibold uppercase tracking-wide text-white/60">
                ¿Cuántos regalos necesitas?
              </span>
              <input
                type="number"
                name="cantidad"
                defaultValue={100}
                min={1}
                className="rounded-xl border-0 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <button
              type="submit"
              className="self-end cursor-pointer rounded-xl bg-brand px-6 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark"
            >
              Dame ideas
            </button>
          </form>
        </div>
      </section>

      {/* Categorías populares */}
      <section id="categorias" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">
          Categorías populares de regalos de empresa
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Inspírate con las categorías más buscadas de nuestro catálogo.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/catalogo?categoria=${c.slug}`}
              className="group flex items-center justify-between rounded-2xl border border-border bg-white px-5 py-4 transition-colors hover:border-brand"
            >
              <span className="flex flex-col">
                <span className="font-display text-sm font-semibold text-ink group-hover:text-brand">
                  {c.name}
                </span>
                {c.fromPrice !== null && (
                  <span className="mt-0.5 text-xs text-ink-soft">Desde {c.fromPrice.toFixed(2)} €</span>
                )}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-ink-soft">
                {c.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Garantía */}
      <section id="garantia" className="bg-muted">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">
            Por qué confiar en nosotros para tus regalos publicitarios
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {TRUST_BADGES.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-white p-6">
                <p className="font-display text-base font-bold text-ink">{b.title}</p>
                <p className="mt-2 text-sm text-ink-soft">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">Cómo funciona tu pedido</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-border bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light font-display text-sm font-bold text-brand">
                {s.step}
              </span>
              <p className="mt-4 font-display text-base font-bold text-ink">{s.title}</p>
              <p className="mt-2 text-sm text-ink-soft">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-brand px-6 py-14 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">¿Listo para tu próximo regalo de empresa?</h2>
          <p className="max-w-xl text-white/90">
            Cuéntanos qué necesitas y te preparamos un presupuesto sin compromiso en menos de 24 horas.
          </p>
          <Link
            href="/presupuesto"
            className="mt-2 cursor-pointer rounded-full bg-ink px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-black"
          >
            Calcula tu presupuesto
          </Link>
        </div>
      </section>
    </>
  );
}
