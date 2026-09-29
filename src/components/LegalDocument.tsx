import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";

type Segment = { text: string; placeholder: boolean };

function splitPlaceholders(text: string): Segment[] {
  const segments: Segment[] = [];
  let depth = 0;
  let buf = "";
  const flush = (placeholder: boolean) => {
    if (buf) segments.push({ text: buf, placeholder });
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("[[", i)) {
      if (depth === 0) flush(false);
      depth++;
      buf += "[[";
      i++;
    } else if (text.startsWith("]]", i) && depth > 0) {
      buf += "]]";
      i++;
      depth--;
      if (depth === 0) flush(true);
    } else {
      buf += text[i];
    }
  }
  flush(depth > 0);
  return segments;
}

function formatEmphasis(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  return splitPlaceholders(text).map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    if (seg.placeholder) {
      return (
        <mark key={key} className="rounded bg-yellow-200 px-1 text-ink">
          {seg.text}
        </mark>
      );
    }
    return <span key={key}>{formatEmphasis(seg.text, key)}</span>;
  });
}

function parseRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function renderMarkdown(source: string): ReactNode[] {
  const lines = source.split(/\r?\n/);
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;

    if (!line.trim()) {
      i++;
    } else if (line.startsWith("# ")) {
      out.push(
        <h1 key={key} className="text-3xl font-bold text-ink sm:text-4xl">
          {inline(line.slice(2), key)}
        </h1>,
      );
      i++;
    } else if (line.startsWith("## ")) {
      out.push(
        <h2 key={key} className="mt-10 text-xl font-bold text-ink">
          {inline(line.slice(3), key)}
        </h2>,
      );
      i++;
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      const [head, , ...body] = rows;
      out.push(
        <div key={key} className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-ink">
                {head.map((c, ci) => (
                  <th key={ci} className="py-2 pr-4 font-display font-semibold">
                    {inline(c, `${key}h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-border align-top">
                  {r.map((c, ci) => (
                    <td key={ci} className="py-2 pr-4 text-ink-soft">
                      {inline(c, `${key}r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={key} className="mt-4 list-disc space-y-1.5 pl-6 text-ink-soft">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `${key}i${ii}`)}</li>
          ))}
        </ul>,
      );
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#|\||- )/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      out.push(
        <p key={key} className="mt-4 leading-relaxed text-ink-soft">
          {inline(para.join(" "), key)}
        </p>,
      );
    }
  }
  return out;
}

export default async function LegalDocument({ file }: { file: string }) {
  const source = await readFile(
    path.join(process.cwd(), "content", "legal", file),
    "utf8",
  );
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {renderMarkdown(source)}
    </article>
  );
}
