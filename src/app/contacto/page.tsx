"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ContactForm() {
  const searchParams = useSearchParams();
  const producto = searchParams.get("producto") ?? "";
  const resumen = searchParams.get("resumen") ?? "";
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (status === "sent") {
    return (
      <div className="rounded-3xl border border-border bg-white p-10 text-center">
        <h2 className="text-2xl font-bold text-ink">¡Gracias por tu mensaje!</h2>
        <p className="mt-2 text-ink-soft">
          Te responderemos con tu presupuesto en menos de 24 horas laborables.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error || "No se pudo enviar el mensaje.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorMessage("No se pudo conectar con el servidor. Inténtalo de nuevo.");
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-3xl border border-border bg-white p-8"
    >
      {status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Nombre *</span>
          <input
            required
            type="text"
            name="nombre"
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Email *</span>
          <input
            required
            type="email"
            name="email"
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Empresa</span>
          <input
            type="text"
            name="empresa"
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Teléfono</span>
          <input
            type="tel"
            name="telefono"
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-semibold text-ink">¿Qué necesitas? *</span>
        <textarea
          required
          name="mensaje"
          rows={5}
          defaultValue={resumen || (producto ? `Me interesa: ${producto}\n\n` : "")}
          className="rounded-xl border border-border px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "sending" ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="font-display text-xs font-bold uppercase tracking-wide text-brand">
        Contacto
      </span>
      <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
        Cuéntanos qué regalo necesitas
      </h1>
      <p className="mt-3 text-ink-soft">
        Rellena el formulario y te preparamos un presupuesto sin compromiso en menos de 24 horas.
      </p>

      <div className="mt-10">
        <Suspense fallback={null}>
          <ContactForm />
        </Suspense>
      </div>
    </div>
  );
}
