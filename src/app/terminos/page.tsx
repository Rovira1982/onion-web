import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = { title: "Términos y condiciones de venta" };

export default function TerminosPage() {
  return <LegalDocument file="terminos-condiciones.md" />;
}
