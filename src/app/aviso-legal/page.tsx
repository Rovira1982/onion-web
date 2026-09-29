import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = { title: "Aviso legal" };

export default function AvisoLegalPage() {
  return <LegalDocument file="aviso-legal.md" />;
}
