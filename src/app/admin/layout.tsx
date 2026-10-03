import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { logoutAdmin } from "./logout-action";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();

  // No session -> this is /admin/login (the only /admin/* page Proxy lets
  // through unauthenticated) — render it bare, without the admin chrome.
  if (!user) return <>{children}</>;

  return (
    <div>
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <nav className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <Link href="/admin/pedidos" className="text-ink hover:text-brand">Pedidos</Link>
            <Link href="/admin/catalogo" className="text-ink hover:text-brand">Catálogo a revisar</Link>
            <Link href="/admin/tandas" className="text-ink hover:text-brand">Tandas</Link>
            <Link href="/admin/codigos" className="text-ink hover:text-brand">Códigos</Link>
            <Link href="/admin/promociones" className="text-ink hover:text-brand">Promociones</Link>
            <Link href="/admin/ocasiones" className="text-ink hover:text-brand">Ocasiones</Link>
          </nav>
          <span className="hidden text-xs text-ink-soft sm:inline">Conectado como {user.email}</span>
          <form action={logoutAdmin}>
            <button type="submit" className="cursor-pointer text-xs font-semibold text-brand hover:text-brand-dark">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
