# TODO — Mejoras de cara al público (benchmark de competencia) + guía de etiquetado de ocasiones

**Fecha:** 29 septiembre 2026
**Para:** agente/sesión de Claude Code que trabaje sobre `E:\onion\26\web`
**Fuente:** revisión de 3 sesiones — auditoría UX interna ([docs/auditoria-ux-2026-09-29.md](auditoria-ux-2026-09-29.md)), benchmark de plazos de entrega de 14 competidores, y scraping directo de Kamishito (líder español en camisetas de despedida/peñas — el competidor más alineado con el público real de Onion and Back).

No se ha tocado código en esta sesión. Este archivo es un encargo listo para ejecutar.

---

## 0. Cómo usar este archivo

Cada tarea lleva una etiqueta:
- **Ejecutable ya** — el agente puede implementarlo sin más información.
- **NECESITA: ...** — falta un dato o un activo real (foto, cifra, decisión) que solo puede dar el negocio. No inventar el valor; dejar el hueco preparado en código o preguntar antes de rellenar con un placeholder.

Prioridad P0 (bloquea la promesa principal del sitio) → P1 (pérdida de conversión/confianza) → P2 (mejora menor).

---

## 1. [P0] Etiquetar productos reales en las ocasiones "Despedidas" y "Peñas"

**Dónde:** `/admin/ocasiones/despedidas` y `/admin/ocasiones/penyas-fiestas` (requiere sesión admin). El picker busca productos del catálogo propio por nombre (mínimo 2 caracteres) y los asigna con un clic — ver [OccasionPicker.tsx](../src/app/admin/ocasiones/[slug]/OccasionPicker.tsx) y [actions.ts](../src/app/admin/ocasiones/actions.ts).

**Por qué es P0:** [seed-occasions.ts](../prisma/seed-occasions.ts) creó las 8 ocasiones como filas vacías — el propio comentario del archivo dice que asignar productos es "un paso manual pendiente, sin hacer". La home ya enlaza `¿Para qué lo necesitas?` → `/catalogo?ocasion=despedidas` (ver [page.tsx:118-134](../src/app/page.tsx:118)): si nadie ha etiquetado nada, ese clic —en la categoría de mayor volumen del negocio— lleva a un catálogo vacío o sin filtrar.

**No es tarea de keyword-matching automático** — la decisión de negocio (misma fuente) es que la curación sea manual e intencional, no un guess por palabra clave. Lo que sigue es una **lista de búsqueda** para acelerar esa curación en el picker, basada en lo que vende hoy el competidor más directo (Kamishito) para exactamente estas dos ocasiones — no son categorías del proveedor, son términos a probar en el buscador del admin contra el catálogo real de Gorfactory/Roly/TopTex/Valento:

### Despedidas de soltero/a
- Camisetas básicas unisex blanca y negra (producto ancla — el que lleva la frase/diseño gracioso, el de mayor rotación)
- Variantes diferenciadas por sexo si el catálogo las tiene ("team bride" / despedida chica vs. despedida chico — en Kamishito son dos productos distintos, no uno genérico)
- Sudaderas (para fechas de otoño/invierno)
- Una camiseta tipo "organizador/staff" para quien lleva el grupo

### Peñas y fiestas de pueblo
- Camisetas básicas unisex blanca y negra en cantidad (Kamishito exige mínimo 20 uds en su producto exprés — señal de que aquí el pedido medio es grande)
- Sudaderas con y sin capucha
- Polos
- Camisetas técnicas de poliéster (para la peña que también organiza algo deportivo)
- Camiseta "STAFF" para organización

### Empresas y equipos (referencia adicional, no es P0 pero sirve para cuando se aborde)
- Ropa de trabajo (pantalón, chaqueta, bata)
- Polos serigrafiados/bordados
- Camisetas técnicas deportivas con logo
- Sudaderas corporativas

### Regalos personalizados (referencia adicional)
- Bolsas de tela / tote bags
- Cojines
- Delantales (adulto e infantil)
- Pósters A3/A4
- Camisetas y bodies de bebé/niño

### Navidad, Equipación deportiva, Comuniones, Bodas
Sin evidencia directa de Kamishito para estas cuatro (no tiene categoría dedicada visible). No inventar productos de referencia — curar directamente contra catálogo propio cuando llegue su turno.

---

## 2. [P0] Sustituir el logo del hero por una foto real

**Dónde:** [page.tsx:102-114](../src/app/page.tsx:102) — la columna derecha del hero muestra hoy el logo de la marca (`/brand/logo-black.webp`) dentro de una tarjeta blanca.

**NECESITA:** la foto real ya identificada por el negocio — el detalle personalizado para `@asevi.es` (sopar d'empresa), documentada en `Negoci/content-calendar-lanzamiento-web.md` punto 4 y punto 3 del calendario de lanzamiento. Si el archivo de imagen no está todavía en el repo/activos, preguntar por él antes de tocar el componente — no sustituir por una imagen genérica o generada.

Competidor de referencia: Kamishito abre con fotografía real de producto/gente en el primer viewport, nunca con su logotipo.

---

## 3. [P1] Prueba social numérica en la home — Ejecutable ya (dato ya verificado)

**Dónde:** nueva sección o ampliación del bloque `Por qué confiar en nosotros` en [page.tsx:267-282](../src/app/page.tsx:267).

**Dato real, verificado el 29/09 en la ficha de Google Business del negocio:**
- Google: **5/5** (4 reseñas)
- Facebook: **5,0/5** (13 reseñas), **+2.500 seguidores**
- Instagram (@onionandback): **+570 seguidores**

El número de reseñas de Google es bajo (4) comparado con el competidor de referencia (Kamishito: 4,6★/378 reseñas) — **no presentarlo igual que ellos** (una barra "reseñas de Google" con solo 4 reseñas se ve débil, no fuerte). Mejor opción: destacar la cifra de Facebook (5,0/13 reseñas + 2.500 seguidores, más sólida) y/o combinarla con "12 años" y una foto real de pedido, en vez de un badge tipo "opiniones de Google" que aquí jugaría en contra. Si el negocio quiere subir la cifra de reseñas de Google antes de destacarlo en la web, es una acción aparte (pedir reseña a clientes recientes) — no bloquea el resto de esta tarea.

**Relacionado — acción fuera de la web, no de código:** la ficha de Google Business (`Onion And Back Advertising Management`, El Ràfol d'Almúnia) **no tiene el sitio web enlazado todavía** — aparece "Añadir sitio web". En cuanto onionandback.com esté publicado, añadir la URL ahí es gratis y probablemente la fuente de tráfico local más directa que tiene el negocio hoy. Avisar al dueño; no es algo que el agente pueda hacer desde el repo.

---

## 4. [P1] Plazo de entrega concreto en el hero / bloque de garantía

**Dónde:** `TRUST_BADGES` en [page.tsx:13-26](../src/app/page.tsx:13), bloque "Entrega siempre en fecha".

**NECESITA:** plazo real de fabricación + envío por técnica. La hoja de costes interna (`ayuda.txt` en el scratchpad de la sesión anterior) ya modela tiempos de producción por técnica (ej. DTF: 25s/prenda) pero no un plazo de entrega total al cliente. Sin esta cifra no tocar el copy — es un compromiso "por escrito" según el propio texto, así que no puede ser aproximado.

Casi todos los competidores textiles llevan un número en el titular ("24-48h", "3-5 días"); Onion and Back compite hoy solo con la promesa sin cifra.

---

## 5. [P1] Dar más peso a WhatsApp — Ejecutable ya

**Dónde:** [Footer.tsx:63-84](../src/components/Footer.tsx:63) — hoy WhatsApp es una línea más en la lista de contacto, con el mismo peso que el email.

**Qué hacer:** añadir un botón/CTA de WhatsApp visible en `/catalogo` y en la ficha de producto (`ProductDetailClient.tsx`), no solo en el footer. El número ya existe (`+34 616 11 40 95`, enlace `https://wa.me/34616114095` ya usado en el footer) — es tarea de componente, no de datos nuevos. Según el brand kit, WhatsApp es el canal real de venta hoy; ningún competidor revisado lo usa así, así que es diferenciación pura si se ejecuta.

---

## 6. [P2] "Desde X €" en las tarjetas de categoría de la home — Ejecutable ya

**Dónde:** sección "Categorías populares" en [page.tsx:210-234](../src/app/page.tsx:210) y `getTopCategories` en `src/lib/products.ts` — hoy cada tarjeta solo muestra el nombre y el nº de productos (`c.count`).

**Qué hacer:** comprobar si `getTopCategories` puede devolver también el precio mínimo de cada categoría (dato ya disponible en la tabla de productos) y mostrarlo como "desde X €" junto al contador. Es el mismo patrón que usa Kamishito en portada ("camisetas desde 3,85€") para anclar expectativa de precio antes de entrar al catálogo.

---

## Orden recomendado

1. Etiquetar despedidas y peñas (§1) — sin esto, la funcionalidad ya construida de la home no sirve de nada.
2. Foto real del hero (§2) — bloqueado solo por el activo, no por decisión.
3. WhatsApp más visible (§5) y "desde X€" (§6) — ambos ejecutables ya, sin dependencias.
4. Prueba social (§3) y plazo concreto (§4) — esperar a que el negocio confirme las cifras reales.
