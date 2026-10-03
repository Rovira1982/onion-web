import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import {
  buildCliente,
  buildPedido,
  buildLineas,
  exportWarning,
  resolveFactusolClientCode,
  resolveFactusolDocNumber,
  markOrdersExported,
} from "@/lib/factusol";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return new NextResponse("Pedido no encontrado", { status: 404 });

  // "Incluir CLI.xlsx aunque el cliente ya tenga código" — Finanzas,
  // 2026-10-02: Josep puede borrar un cliente de prueba en FactuSol sin que
  // la web se entere, así que a veces hace falta forzarlo.
  const forceCli = new URL(req.url).searchParams.get("forceCli") === "1";

  const { code: clientCode, isNew } = await resolveFactusolClientCode(order.invoiceTaxId);
  const docNumber = await resolveFactusolDocNumber(order.id);

  const [pcl, lpc] = await Promise.all([
    buildPedido(order, clientCode, docNumber),
    buildLineas(order, order.lines, docNumber),
  ]);

  const archive = new ZipArchive();
  const stream = new PassThrough();
  archive.pipe(stream);
  // CLI.xlsx solo si FactuSol todavía no conoce a este cliente (o si se
  // fuerza) — reimportar el de uno ya existente no aporta nada.
  if (isNew || forceCli) {
    const cli = await buildCliente(order, clientCode);
    archive.append(Buffer.from(cli), { name: "CLI.xlsx" });
  }
  archive.append(Buffer.from(pcl), { name: "PCL.xlsx" });
  archive.append(Buffer.from(lpc), { name: "LPC.xlsx" });
  const warning = exportWarning(order, order.lines);
  if (warning) {
    archive.append(Buffer.from(`AVISO — revisar antes de importar en FactuSol:\n\n${warning}\n`, "utf8"), {
      name: "AVISO.txt",
    });
  }
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const zipBuffer = Buffer.concat(chunks);

  await markOrdersExported([order.id]);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="factusol-pedido-${id.slice(0, 8)}.zip"`,
    },
  });
}
