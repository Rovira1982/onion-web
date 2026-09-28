import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-compatible object storage for customer-uploaded logos.
// Bucket is private (no public access); files are served back through
// src/app/api/uploads/[key]/route.ts instead of a public R2/r2.dev URL, so
// nothing here depends on the bucket's public-access setting.
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getFile(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!result.Body) return null;
    return {
      body: result.Body.transformToWebStream(),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}
