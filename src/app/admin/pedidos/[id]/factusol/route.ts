import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import { buildCliente, buildPedido, buildLineas } from "@/lib/factusol";
import { requireAdmin } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return new NextResponse("Pedido no encontrado", { status: 404 });

  const [cli, pcl, lpc] = await Promise.all([
    buildCliente(order),
    buildPedido(order),
    buildLineas(order, order.lines),
  ]);

  const archive = new ZipArchive();
  const stream = new PassThrough();
  archive.pipe(stream);
  archive.append(Buffer.from(cli), { name: "CLI.xlsx" });
  archive.append(Buffer.from(pcl), { name: "PCL.xlsx" });
  archive.append(Buffer.from(lpc), { name: "LPC.xlsx" });
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="factusol-pedido-${id.slice(0, 8)}.zip"`,
    },
  });
}
