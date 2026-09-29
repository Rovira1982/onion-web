"use client";

import { OPEN_SETTINGS_EVENT } from "@/lib/consent";

export default function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
    >
      Configurar cookies
    </button>
  );
}
