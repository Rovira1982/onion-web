import { NextResponse } from "next/server";
import { getFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const file = await getFile(key.join("/"));
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
