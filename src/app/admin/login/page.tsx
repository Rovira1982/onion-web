"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAdmin } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await loginAdmin(email, password);
    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(searchParams.get("next") || "/admin/pedidos");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Acceso administración</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-white p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-soft">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-soft">Contraseña</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
