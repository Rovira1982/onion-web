import { getCatalogReview, type ReviewSection } from "@/lib/catalog-review";
import { requireAdmin } from "@/lib/auth";

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function Section({ title, hint, section }: { title: string; hint: string; section: ReviewSection }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-ink">
        {title} <span className="text-ink-soft">({section.total})</span>
      </h2>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      {section.total === 0 ? (
        <p className="mt-3 text-sm text-green-700">Ninguno. Todo en orden.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-ink-soft">
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Proveedor</th>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Precio base</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="px-4 py-2 text-ink">{r.name}</td>
                  <td className="px-4 py-2 text-ink-soft">{r.supplier}</td>
                  <td className="px-4 py-2 text-ink-soft">{r.sku}</td>
                  <td className="px-4 py-2 text-ink-soft">{r.stock}</td>
                  <td className="px-4 py-2 text-ink-soft">{money(r.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {section.total > section.rows.length && (
            <p className="px-4 py-2 text-xs text-ink-soft">
              Se muestran los primeros {section.rows.length} de {section.total}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default async function AdminCatalogoPage() {
  await requireAdmin();
  const { sinFoto, aCero, sinVariantes } = await getCatalogReview();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink">Catálogo a revisar</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Productos con stock que la tienda no enseña porque les falta algo. Vuelven solos en cuanto el proveedor manda el
        dato. El informe completo de calidad de datos se genera con <code>npm run audit:catalogo</code>.
      </p>

      <Section
        title="Sin ninguna foto"
        hint="Sin foto no se puede vender: ocultos hasta que el proveedor mande una."
        section={sinFoto}
      />
      <Section
        title="Con precio a 0 €"
        hint="Se podrían pedir gratis: ocultos hasta tener tarifa del proveedor."
        section={aCero}
      />
      <Section
        title="Sin variantes (tallas/colores)"
        hint="No hay nada que añadir al carrito: ocultos hasta que el proveedor mande variantes."
        section={sinVariantes}
      />
    </div>
  );
}
