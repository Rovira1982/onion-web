import Link from "next/link";
import Image from "next/image";
import { getTopCategories } from "@/lib/products";
import { categoryIcon } from "@/lib/category-icon";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import FooterVatNote from "@/components/FooterVatNote";

export default async function Footer() {
  const categories = await getTopCategories(30);

  return (
    <footer className="mt-24 border-t border-border bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Image
              src="/brand/logo-full.webp"
              alt="Onion and Back"
              width={160}
              height={68}
              className="h-12 w-auto brightness-0 invert"
            />
            <p className="mt-4 max-w-xs text-sm text-white/70">
              Regalos de empresa y artículos publicitarios personalizados con tu logo.
              Rapidez, calidad y trato cercano en cada pedido.
            </p>
          </div>

          <div className="md:col-span-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand">
              Categorías
            </h3>
            {/* Pastillas blancas en vez de texto plano — sobre el fondo
                oscuro del pie el texto solo no destacaba lo suficiente
                (feedback del dueño, 2026-09-30). */}
            <ul className="mt-4 flex flex-wrap gap-2">
              {categories.map((c) => {
                const Icon = categoryIcon(c.name);
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/catalogo?categoria=${c.slug}`}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-brand hover:text-white"
                    >
                      <Icon size={14} className="shrink-0" aria-hidden="true" />
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand">
              Empresa
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <Link href="/#garantia" className="hover:text-white">Garantía 360º</Link>
              </li>
              <li>
                <Link href="/catalogo" className="hover:text-white">Catálogo completo</Link>
              </li>
              <li>
                <Link href="/contacto" className="hover:text-white">Contacto</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand">
              Contacto
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <a href="mailto:info@onionandback.com" className="hover:text-white">
                  info@onionandback.com
                </a>
              </li>
              <li>
                <a href="tel:+34616114095" className="hover:text-white">
                  +34 616 11 40 95
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/34616114095"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Onion and Back. Todos los derechos reservados.</p>
          <FooterVatNote />
        </div>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/50 sm:justify-start">
          <li>
            <Link href="/aviso-legal" className="hover:text-white">Aviso legal</Link>
          </li>
          <li>
            <Link href="/privacidad" className="hover:text-white">Política de privacidad</Link>
          </li>
          <li>
            <Link href="/cookies" className="hover:text-white">Política de cookies</Link>
          </li>
          <li>
            <Link href="/terminos" className="hover:text-white">Términos y condiciones</Link>
          </li>
          <li>
            <CookieSettingsButton className="cursor-pointer hover:text-white" />
          </li>
        </ul>
      </div>
    </footer>
  );
}
