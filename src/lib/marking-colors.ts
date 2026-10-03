import type { Technique } from "./pricing";

// Color en el que el cliente quiere el marcaje (no el de la prenda). Se
// pregunta porque el maniquí de la vista previa es solo blanco o negro: un
// logo blanco sobre la camiseta blanca no se vería, y producción necesita
// saber el color real a estampar.
export const MARKING_COLOR_PALETTE = [
  "Blanco",
  "Negro",
  "Rojo",
  "Azul",
  "Amarillo",
  "Verde",
  "Naranja",
  "Rosa",
  "Gris",
  "Dorado",
  "Plateado",
] as const;

// Sublimación imprime sobre fondo blanco con tinta de color: el cliente no
// elige "color del marcaje". El resto sí (DTF a todo color también: un
// logo de un solo color es lo habitual).
export const ASKS_MARKING_COLOR: Record<Technique, boolean> = {
  DTF: true,
  Sublimacion: false,
  Serigrafia: true,
  Vinilo: true,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ¿La prenda es oscura? Decide si la vista previa arranca con el maniquí
// negro (donde un logo blanco sí se ve) o con el blanco. Heurística por el
// nombre del color del proveedor; ante la duda, claro.
export function isDarkGarmentColor(name: string): boolean {
  const n = normalize(name);
  if (!n) return false;
  if (/claro|light|cielo|celeste|pastel|fluor/.test(n)) return false;
  if (/negr|black|marino|navy|oscur|dark|antracit|carbon/.test(n)) return true;
  if (/blanc|white|crudo|natural|beige|crema|arena|hueso|marfil|amarill|yellow|gris|grey|gray|plat|rosa|pink/.test(n)) return false;
  return /negr|black|marino|navy|oscur|dark|burdeos|granate|antracit|carbon|chocolate|vino|morad|purp|botella|bosque|petrole|noche|royal|rey|rojo|red|verde|green|azul|blue|marron|brown/.test(n);
}
