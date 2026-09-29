// Display-only normalization for category names. The raw names come
// straight from each supplier's own export/API (ALL CAPS, mixed languages —
// Catalan from Gorfactory's ca-ES exports, English from TopTex) and are
// never rewritten in the database — this only cleans up what's shown to
// the customer. See docs/auditoria-ux-2026-09-29.md, hallazgo #2.

// Known Catalan (or otherwise mismatched) supplier category names, mapped to
// their Spanish equivalent. Not exhaustive — anything missing here falls
// back to sentence-case below, which at least stops it shouting in caps.
const TRANSLATIONS: Record<string, string> = {
  BANYADORS: "Bañadores",
  "BOSSES I MOTXILLES": "Bolsas y mochilas",
  CALÇAT: "Calzado",
  CALENDARIS: "Calendarios",
  CÀMERES: "Cámaras",
  CARMANYOLES: "Fiambreras",
  COMPLEMENTS: "Complementos",
  "CONJUNTS ESPORTIUS": "Conjuntos deportivos",
  ESPELMES: "Velas",
  FALDILLES: "Faldas",
  JOCS: "Juegos",
  MOCADORS: "Pañuelos",
  "MOCADORS TUBULARS DE COLL": "Pañuelos tubulares de cuello",
  MOTXILLES: "Mochilas",
  OBRIDORS: "Abridores",
  "PETOS ESPORTIUS": "Petos deportivos",
  PILOTES: "Balones",
  "RASPALLS DE DENTS": "Cepillos de dientes",
  "ROBA BEBÈ": "Ropa bebé",
  "Roba d`abric": "Ropa de abrigo",
  "ROBA ESPORTIVA": "Ropa deportiva",
  SANITARI: "Sanitario",
  "SETS DE FORMATGES": "Sets de quesos",
  TALLAVENTS: "Cortavientos",
  "TASSES I VAIXELLA": "Tazas y vajilla",
  TESTOS: "Macetas",
};

function toSentenceCase(input: string): string {
  const lower = input.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function displayCategoryName(raw: string): string {
  const translated = TRANSLATIONS[raw];
  if (translated) return translated;

  // Leave names that already look intentionally cased (mixed upper/lower,
  // like Cifra's "Bolsas" or "Agendas, libretas y cuadernos") untouched —
  // only fix names that are ALL CAPS or all lowercase.
  const isShouting = raw === raw.toUpperCase() && raw !== raw.toLowerCase();
  const isAllLower = raw === raw.toLowerCase() && raw !== raw.toUpperCase();
  if (isShouting || isAllLower) return toSentenceCase(raw);

  return raw;
}
