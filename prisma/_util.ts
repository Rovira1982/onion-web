import { writeFileSync } from "node:fs";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// UTF-8 con BOM para que Excel abra bien los acentos.
export function writeCsv(path: string, rows: string[]): void {
  writeFileSync(path, "\uFEFF" + rows.join("\n"), "utf-8");
}
