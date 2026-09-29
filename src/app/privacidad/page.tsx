import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacidadPage() {
  return <LegalDocument file="politica-privacidad.md" />;
}
