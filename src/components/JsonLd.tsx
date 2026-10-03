// JSON-LD para buscadores. `<` se escapa para que un nombre de producto con
// "</script>" no pueda cerrar la etiqueta.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }}
    />
  );
}
