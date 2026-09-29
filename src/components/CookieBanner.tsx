"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  OPEN_SETTINGS_EVENT,
  readMarketingConsent,
  saveConsent,
  useConsent,
} from "@/lib/consent";

export default function CookieBanner() {
  const consent = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const open = () => {
      setMarketing(readMarketingConsent());
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  if (consent === undefined) return null;
  if (consent !== null && !settingsOpen) return null;

  const decide = (value: boolean) => {
    saveConsent(value);
    setSettingsOpen(false);
  };

  const btn =
    "cursor-pointer rounded-full px-5 py-2.5 font-display text-sm font-bold transition-colors";
  const secondary = `${btn} border border-border bg-white text-ink hover:bg-muted`;
  const primary = `${btn} bg-brand text-white hover:bg-brand-dark`;

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white p-4 shadow-2xl sm:p-6"
    >
      <div className="mx-auto max-w-4xl">
        <p className="font-display text-base font-bold text-ink">Tu privacidad</p>
        <p className="mt-1 text-sm text-ink-soft">
          Usamos almacenamiento técnico imprescindible para el carrito y el funcionamiento de la
          tienda. Solo con tu permiso activaremos cookies de publicidad de terceros. Más
          información en la{" "}
          <Link href="/cookies" className="font-semibold text-brand underline">
            política de cookies
          </Link>
          .
        </p>

        {settingsOpen && (
          <div className="mt-4 space-y-3 text-sm">
            <label className="flex items-start gap-3 opacity-70">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                <strong className="text-ink">Técnicas (siempre activas).</strong>{" "}
                <span className="text-ink-soft">
                  Carrito, diseños de personalización y tus preferencias de cookies.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong className="text-ink">Publicidad (Meta Pixel).</strong>{" "}
                <span className="text-ink-soft">
                  Mide campañas en Facebook e Instagram. Desactivada por defecto.
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={secondary} onClick={() => decide(false)}>
            Rechazar
          </button>
          {settingsOpen ? (
            <button type="button" className={secondary} onClick={() => decide(marketing)}>
              Guardar selección
            </button>
          ) : (
            <button
              type="button"
              className={secondary}
              onClick={() => {
                setMarketing(consent?.marketing ?? false);
                setSettingsOpen(true);
              }}
            >
              Configurar
            </button>
          )}
          <button type="button" className={primary} onClick={() => decide(true)}>
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}
