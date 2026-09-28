// Real product mockup photos (own, in public/mockups/) used as the
// background for the logo positioner and its flattened preview — replaced
// the flat SVG silhouettes below now that we have real photography.
// Same-origin (served from our own /public), so canvas compositing never
// hits the CORS taint issue a supplier's own CDN photo would (see
// AddToCartForm.tsx's renderZonesPreview).
export type MarkZone = "pecho" | "espalda" | "manga_izquierda" | "manga_derecha";
export type MockupGarment = "camiseta" | "sudadera";
export type MockupColor = "blanco" | "negro";

export const MOCKUP_GARMENTS: { value: MockupGarment; label: string }[] = [
  { value: "camiseta", label: "Camiseta" },
  { value: "sudadera", label: "Sudadera" },
];

export const MOCKUP_COLORS: { value: MockupColor; label: string }[] = [
  { value: "blanco", label: "Blanco" },
  { value: "negro", label: "Negro" },
];

const ZONE_FILE_SUFFIX: Record<MarkZone, string> = {
  pecho: "frontal",
  espalda: "trasera",
  manga_izquierda: "manga-izquierda",
  manga_derecha: "manga-derecha",
};

export function mockupImageUrl(garment: MockupGarment, color: MockupColor, zone: MarkZone): string {
  return `/mockups/${garment}-${color}-${ZONE_FILE_SUFFIX[zone]}.png`;
}

export const ZONE_LABEL: Record<MarkZone, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  manga_izquierda: "Manga izquierda",
  manga_derecha: "Manga derecha",
};

// Flat SVG silhouettes — kept as a fallback for any future garment/color
// combo we don't have a real photo for yet (drawn via the Path2D API, own
// artwork, no licensing question). Not used while all 4 current
// combinations (camiseta/sudadera × blanco/negro) have real photos.
export const ZONE_VIEW: Record<MarkZone, { label: string; path: string }> = {
  pecho: {
    label: "Vista frontal",
    path: "M120,30 L70,50 L30,70 L55,160 L95,120 L90,340 L210,340 L205,120 L245,160 L270,70 L230,50 L180,30 Q150,55 120,30 Z",
  },
  espalda: {
    label: "Vista trasera",
    path: "M120,30 L70,50 L30,70 L55,160 L95,120 L90,340 L210,340 L205,120 L245,160 L270,70 L230,50 L180,30 L120,30 Z",
  },
  manga_izquierda: {
    label: "Vista lateral",
    path: "M140,30 Q100,30 90,70 L70,90 L40,150 Q35,170 55,175 L90,140 L100,340 L180,340 L170,70 Q160,30 140,30 Z",
  },
  manga_derecha: {
    label: "Vista lateral",
    path: "M140,30 Q100,30 90,70 L70,90 L40,150 Q35,170 55,175 L90,140 L100,340 L180,340 L170,70 Q160,30 140,30 Z",
  },
};

export const MOCKUP_VIEWBOX = "0 0 300 360";
