import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";
import CookieSettingsButton from "@/components/CookieSettingsButton";

export const metadata: Metadata = { title: "Política de cookies" };

export default function CookiesPage() {
  return (
    <>
      <LegalDocument file="politica-cookies.md" />
      <div className="mx-auto -mt-8 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <CookieSettingsButton className="cursor-pointer rounded-full bg-brand px-6 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark" />
      </div>
    </>
  );
}
