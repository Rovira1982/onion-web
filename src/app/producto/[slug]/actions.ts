"use server";

import { randomUUID } from "node:crypto";
import { uploadFile } from "@/lib/storage";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// file.type lo manda el navegador y es trivial de falsificar (una petición
// multipart a mano puede poner cualquier Content-Type) — hay que comprobar
// el contenido real. PNG/JPEG por los bytes mágicos; SVG es texto, así que
// además de empezar por <svg/<?xml se descarta si lleva algo ejecutable
// (<script>, onXxx=, javascript:, <foreignObject> — vector clásico de XSS
// guardado en un SVG servido desde nuestro propio dominio). Parche de
// seguridad, Guardian, 2026-10-01.
function matchesRealType(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/svg+xml") {
    const text = buffer.toString("utf8", 0, Math.min(buffer.length, MAX_SIZE));
    const head = text.trimStart().slice(0, 100).toLowerCase();
    if (!head.startsWith("<svg") && !head.startsWith("<?xml")) return false;
    const lower = text.toLowerCase();
    if (/<script|onload\s*=|onerror\s*=|javascript:|<foreignobject/i.test(lower)) return false;
    return true;
  }
  return false;
}

export type SubirLogoResult = { url: string } | { error: string };

export async function subirLogo(formData: FormData): Promise<SubirLogoResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return { error: "Formato no admitido. Usa PNG, JPG o SVG." };
  if (file.size > MAX_SIZE) return { error: "El archivo pesa demasiado (máximo 5 MB)." };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesRealType(buffer, file.type)) {
    return { error: "El archivo no parece ser un PNG, JPG o SVG válido." };
  }

  const key = `logos/${randomUUID()}.${ext}`;
  await uploadFile(key, buffer, file.type);

  return { url: `/api/uploads/${key}` };
}
