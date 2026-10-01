import { NextResponse } from "next/server";
import { getFile } from "@/lib/storage";

// Esta ruta sirve de todo (fotos de producto de cada proveedor, logos que
// suben los clientes bajo "logos/") — NO se puede restringir solo a
// "logos/" como proponía el parche original de Guardian, rompería el
// catálogo entero. En vez de eso: cabeceras de endurecimiento universales,
// seguras para cualquier tipo de archivo, que neutralizan el riesgo real
// (un SVG de cliente con <script> ejecutándose en nuestro dominio) sin
// tocar el resto. 2026-10-01.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const joined = key.join("/");
  if (joined.includes("..")) return new NextResponse("Not found", { status: 404 });

  const file = await getFile(joined);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Evita que el navegador intente ejecutar un SVG malicioso como
      // documento HTML/script en nuestro origen (stored XSS vía SVG).
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
