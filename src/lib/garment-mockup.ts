// Flat, generic t-shirt silhouettes (front/back/side) used as a placeholder
// mockup for the logo positioner — drawn as plain SVG paths (no third-party
// image, no licensing question) so each marking zone (pecho/espalda/mangas)
// gets the view it actually needs instead of the product's own single front
// photo. Same path data is used both for the interactive SVG editor and for
// the flattened <canvas> preview (via the Path2D API), so they always match.
export type MarkZone = "pecho" | "espalda" | "mangas";

export const ZONE_VIEW: Record<MarkZone, { label: string; path: string }> = {
  pecho: {
    label: "Vista frontal",
    path: "M120,30 L70,50 L30,70 L55,160 L95,120 L90,340 L210,340 L205,120 L245,160 L270,70 L230,50 L180,30 Q150,55 120,30 Z",
  },
  espalda: {
    label: "Vista trasera",
    path: "M120,30 L70,50 L30,70 L55,160 L95,120 L90,340 L210,340 L205,120 L245,160 L270,70 L230,50 L180,30 L120,30 Z",
  },
  mangas: {
    label: "Vista lateral",
    path: "M140,30 Q100,30 90,70 L70,90 L40,150 Q35,170 55,175 L90,140 L100,340 L180,340 L170,70 Q160,30 140,30 Z",
  },
};

export const MOCKUP_VIEWBOX = "0 0 300 360";
