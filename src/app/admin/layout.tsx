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
          <span className="text-xs text-ink-soft">Conectado como {user.email}</span>
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
