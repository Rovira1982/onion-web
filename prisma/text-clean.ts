// Limpieza de textos de proveedor (nombre y descripción) compartida por los
// importadores y por audit-catalog.ts. Los proveedores mandan HTML suelto
// ("<br/>", "&nbsp;") y dobles espacios; los importadores reescriben name y
// description en cada sincronización, así que limpiar solo en la base de datos
// no sirve: la siguiente sincronización lo volvía a ensuciar.
export const HTML_REMNANT = /<\/?[a-z][^>]*>|&[a-z]{2,8};|&#\d+;/i;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ntilde: "ñ", Ntilde: "Ñ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É",
  Iacute: "Í", Oacute: "Ó", Uacute: "Ú", uuml: "ü", Uuml: "Ü", ordm: "º", ordf: "ª",
  euro: "€", deg: "°", middot: "·", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
};

export function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Nombre de producto: sin HTML y sin espacios repetidos, en una sola línea.
export function cleanName(s: string): string {
  const cleaned = HTML_REMNANT.test(s) ? squash(cleanText(s)) : squash(s);
  return cleaned || s.trim();
}

// Descripción: conserva los saltos de línea, quita HTML y espacios sobrantes.
export function cleanDescription<T extends string | null | undefined>(s: T): T {
  if (typeof s !== "string") return s;
  return (HTML_REMNANT.test(s) ? cleanText(s) : s.trim()) as T;
}
