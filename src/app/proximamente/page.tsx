import type { Metadata } from "next";
import { launchDate } from "@/lib/launch";
import CountdownTimer from "@/components/CountdownTimer";

export const metadata: Metadata = {
  title: "Muy pronto",
  robots: { index: false, follow: false },
};

// Pantalla de cuenta atrás de prelanzamiento — el proxy la enseña en vez de
// la web real mientras no pase LAUNCH_AT (ver src/lib/launch.ts). Texto
// definitivo de Operaciones, 2026-10-02.
export default function ProximamentePage() {
  const date = launchDate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 py-16 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-brand">Onion and Back</p>
      <h1 className="mt-4 max-w-xl font-display text-3xl font-bold text-white sm:text-4xl">
        Estamos dando las últimas puntadas.
      </h1>
      <p className="mt-4 max-w-md text-white/70">
        Camisetas, sudaderas, regalos y equipación con tu logo o tu nombre. La web abre muy pronto.
      </p>

      {date && (
        <div className="mt-10">
          <CountdownTimer targetIso={date.toISOString()} />
        </div>
      )}

      <p className="mt-10 text-sm text-white/50">
        ¿Necesitas algo ya?{" "}
        <a href="https://wa.me/34616114095" className="text-brand hover:underline">
          Escríbenos y te echamos una mano
        </a>
      </p>
    </div>
  );
}
