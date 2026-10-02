"use client";

import { useSyncExternalStore } from "react";

const KEY = "oab_cookie_consent";
const CHANGE_EVENT = "oab:consent-change";
export const OPEN_SETTINGS_EVENT = "oab:open-cookie-settings";
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type Consent = { marketing: boolean; ts: number };

// "ssr" = not yet known (server render); "" = no valid choice stored.
function getSnapshot(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as Consent;
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > MAX_AGE_MS) return "";
    return raw;
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// Nombre de la cookie que lee el servidor (checkout/actions.ts) antes de
// mandar el evento de Meta CAPI — localStorage no es legible desde un
// Server Action. Cookie técnica/necesaria (guarda la propia elección de
// consentimiento, no necesita consentimiento para existir). Parche de
// seguridad/cumplimiento, Guardian P0, 2026-10-02.
export const MARKETING_CONSENT_COOKIE = "oab_marketing_consent";

export function saveConsent(marketing: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ marketing, ts: Date.now() } satisfies Consent));
  } catch {
    // Storage unavailable: the choice just won't persist.
  }
  try {
    document.cookie = `${MARKETING_CONSENT_COOKIE}=${marketing ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies unavailable: the server-side CAPI gate just defaults to "no consent".
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readMarketingConsent(): boolean {
  const snap = getSnapshot();
  return snap !== "" && (JSON.parse(snap) as Consent).marketing === true;
}

// undefined = still loading, null = no choice yet.
export function useConsent(): Consent | null | undefined {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => "ssr");
  if (snap === "ssr") return undefined;
  if (snap === "") return null;
  return JSON.parse(snap) as Consent;
}

export function useMarketingConsent(): boolean {
  return useConsent()?.marketing === true;
}
