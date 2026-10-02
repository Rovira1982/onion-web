import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import type { OrderDetail } from "@/lib/orders";
import {
  buildClientesBulk,
  buildPedidosBulk,
  buildLineasBulk,
  resolveFactusolClientCode,
  resolveFactusolDocNumber,
  listUnexportedOrderIds,
  markOrdersExported,
} from "@/lib/factusol";
import { requireAdmin } from "@/lib/auth";

// "Exportar pedidos nuevos" — un único ZIP con todos los pedidos que todavía
// no se han exportado a FactuSol (entran todos, pagados o no — Finanzas,
// 2026-10-02: incluso transferencia sin cobrar, para no retrasar la
// preparación del documento). Cada pedido incluido se marca como exportado,
// así que una segunda pulsación sin pedidos nuevos entre medias no trae
// nada otra vez.
export async function GET(req: Request) {
  await requireAdmin();
  const forceCli = new URL(req.url).searchParams.get("forceCli") === "1";

  const orderIds = await listUnexportedOrderIds();
  if (orderIds.length === 0) {
    return new NextResponse("No hay pedidos nuevos para exportar.", { status: 200 });
  }
  const orders = (await Promise.all(orderIds.map((id) => getOrderById(id)))).filter(
    (o): o is OrderDetail => o !== null
  );

  const pedidoRows: { order: OrderDetail; clientCode: number; docNumber: number }[] = [];
  const lineaGroups: { docNumber: number; shippingCost?: number; lines: OrderDetail["lines"] }[] = [];
  // Una sola fila de cliente por NIF aunque varios pedidos de este lote sean
  // del mismo cliente — FactuSol no necesita (ni quiere) el mismo cliente
  // repetido dentro del mismo import.
  const clienteRowsByNif = new Map<string, { order: OrderDetail; clientCode: number }>();

  for (const order of orders) {
    const { code: clientCode, isNew } = await resolveFactusolClientCode(order.invoiceTaxId);
    const docNumber = await resolveFactusolDocNumber(order.id);
    pedidoRows.push({ order, clientCode, docNumber });
    lineaGroups.push({ docNumber, shippingCost: order.shippingCost, lines: order.lines });
    if ((isNew || forceCli) && !clienteRowsByNif.has(order.invoiceTaxId)) {
      clienteRowsByNif.set(order.invoiceTaxId, { order, clientCode });
    }
  }

  const [pcl, lpc] = await Promise.all([buildPedidosBulk(pedidoRows), buildLineasBulk(lineaGroups)]);

  const archive = new ZipArchive();
  const stream = new PassThrough();
  archive.pipe(stream);
  if (clienteRowsByNif.size > 0) {
    const cli = await buildClientesBulk([...clienteRowsByNif.values()]);
    archive.append(Buffer.from(cli), { name: "CLI.xlsx" });
  }
  archive.append(Buffer.from(pcl), { name: "PCL.xlsx" });
  archive.append(Buffer.from(lpc), { name: "LPC.xlsx" });
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const zipBuffer = Buffer.concat(chunks);

  await markOrdersExported(orders.map((o) => o.id));

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="factusol-pedidos-nuevos-${today}.zip"`,
    },
  });
}
