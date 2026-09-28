"use server";

import { randomUUID } from "node:crypto";
import { uploadFile } from "@/lib/storage";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export type SubirLogoResult = { url: string } | { error: string };

export async function subirLogo(formData: FormData): Promise<SubirLogoResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return { error: "Formato no admitido. Usa PNG, JPG o SVG." };
  if (file.size > MAX_SIZE) return { error: "El archivo pesa demasiado (máximo 5 MB)." };

  const key = `logos/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(key, buffer, file.type);

  return { url: `/api/uploads/${key}` };
}
