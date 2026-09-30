import Link from "next/link";
import Image from "next/image";
import CartBadge from "@/components/CartBadge";

const NAV_LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  // Segmento con mucho potencial de ingresos (366 productos reales: alta
  // visibilidad, calzado de seguridad, EPI...) que hasta ahora no tenía
  // sitio en la navegación — petición directa del dueño, 2026-09-30.
  { href: "/catalogo?ocasion=ropa-laboral", label: "Ropa Laboral" },
  { href: "/presupuesto", label: "Presupuesto" },
  { href: "/#garantia", label: "Garantía" },
  { href: "/contacto", label: "Contacto" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Onion and Back, inicio">
          <Image
            src="/brand/logo-black.webp"
            alt="Onion and Back"
            width={160}
            height={68}
            priority
            className="h-10 w-auto sm:h-12"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegación principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-display text-sm font-semibold text-ink-soft transition-colors hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/presupuesto"
            className="hidden rounded-full bg-brand px-5 py-2.5 font-display text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-dark sm:inline-flex sm:items-center"
          >
            Pide presupuesto
          </Link>
          <CartBadge />
        </div>

        <details className="relative md:hidden">
          <summary
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-border text-ink"
            aria-label="Abrir menú"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-white p-3 shadow-lg">
            <nav className="flex flex-col gap-1" aria-label="Navegación móvil">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 font-display text-sm font-semibold text-ink-soft hover:bg-muted hover:text-brand"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/presupuesto"
                className="mt-2 rounded-full bg-brand px-3 py-2.5 text-center font-display text-sm font-bold text-white"
              >
                Pide presupuesto
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
