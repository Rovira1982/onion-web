import Link from "next/link";
import Image from "next/image";
import { getTopCategories } from "@/lib/products";

export default async function Footer() {
  const categories = await getTopCategories(10);

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

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-brand">
              Categorías
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/catalogo?categoria=${c.slug}`} className="hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
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
              <li>hola@onionandback.com</li>
              <li>+34 900 000 000</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Onion and Back. Todos los derechos reservados.</p>
          <p>Precios sin IVA. Personalización incluida según artículo.</p>
        </div>
      </div>
    </footer>
  );
}
