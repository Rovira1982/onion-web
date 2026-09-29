# Auditoría UX/diseño — Onion And Back web

**Fecha:** 29 septiembre 2026
**Alcance:** homepage (`/`) y catálogo (`/catalogo`), desktop y móvil, contra `localhost:3000` en desarrollo.
**Método:** inspección visual en navegador (desktop + viewport 375×812), red/consola sin errores, grep del código fuente para tokens de color, accesibilidad y estilos.

No se han aplicado cambios — esto es solo diagnóstico.

---

## Resumen

| # | Hallazgo | Severidad |
|---|---|---|
| 1 | Desplegable de categorías abierto por defecto en `/catalogo` | **P0** |
| 2 | Nombres de categoría sin normalizar (idioma/mayúsculas mezclados) | P1 |
| 3 | Sin banner de cookies ni enlaces a páginas legales | P1 |
| 4 | Orden de catálogo por defecto muestra productos poco representativos primero | P1 |
| 5 | Sin modo oscuro (`prefers-color-scheme`) pese a tener tokens listos | P2 |
| 6 | 3 colores hardcodeados fuera del sistema de tokens | P2 |
| 7 | Zonas de personalización no se adaptan al tipo de producto (una gorra ofrece "Pecho/Espalda/Mangas") | P1 |
| 8 | Sin vista previa visual del logo colocado en el configurador | P2 |
| 9 | Imagen principal del hero rota en la home | **P0** |
| 10 | Teléfono de contacto con pinta de placeholder (`+34 900 000 000`) | P1 |
| 11 | Sin WhatsApp visible en la web pese a ser el canal principal de la marca | P1 |
| 12 | Footer dice "Personalización incluida según artículo" pero el precio sube al activarla | P1 |
| 13 | Catálogo sin agrupación por evento/temporada (despedidas, Navidad, verano...) | P1 |
| 14 | Sin señales de confianza (años, reseñas, clientes reales) en home | P2 |
| 15 | Tono de la copy es corporativo/genérico, no el de la marca | P2 |
| 16 | Sin estado de "sin resultados" ante una búsqueda sin match | P2 |
| 17 | SEO básico (title, alt de imágenes) no revisado | P2 |
| 18 | Iconos SVG sin revisar si llevan `aria-label` | P2 |

*(puntos 7–18: ver "Valoración adicional" — 7, 9, 10, 11, 12, 13 verificados visualmente en `localhost:3000`; el resto sigue sin confirmar en código)*

---

## [P0] Desplegable de categorías abierto por defecto

**Dónde:** `/catalogo`, componente de filtro de categorías (bajo el buscador).
**Qué pasa:** la lista de categorías (con scroll interno, ~30 categorías) aparece **expandida** nada más cargar la página, en desktop y en móvil. Empuja los 5.091 productos fuera de la primera pantalla.
**Impacto en el usuario:** en móvil es especialmente grave — hay que hacer scroll por una lista larga de nombres de categoría antes de ver un solo producto para comprar. El elemento tiene una flecha (▾) que visualmente promete un desplegable cerrado, pero se comporta como si estuviera siempre abierto.
**Recomendación:** que el desplegable arranque **cerrado** por defecto; se abre solo al hacer clic. Es el cambio de mayor impacto de los seis — afecta a la página que más tráfico de intención de compra recibe.

---

## [P1] Nombres de categoría sin normalizar

**Dónde:** `/catalogo`, lista de categorías y badges de categoría en cada tarjeta de producto.
**Qué pasa:** los nombres vienen tal cual del proveedor (Gorfactory/Roly), sin limpieza:
- Mayúsculas sueltas: `PANTALONES`, `CAMISETAS`, `ALTA VISIBILIDAD`
- Catalán sin traducir: `BOSSES I MOTXILLES` (bolsas y mochilas)
- Frases largas como si fueran categorías: `Textil, casual y sport`

**Impacto en el usuario:** para un público general en español (amas de casa, peñas, empresas), esto lee como un catálogo mal traducido o descuidado, no como una tienda con identidad propia — rompe la sensación de "trato cercano y de confianza" que es la promesa de marca.
**Recomendación:** normalizar a formato "Título de frase" en español (`Bolsas y mochilas`, `Pantalones`, `Alta visibilidad`) en una capa de mapeo entre el dato del proveedor y lo que se muestra, sin tocar el dato original.

---

## [P1] Sin banner de cookies ni páginas legales enlazadas

**Dónde:** toda la web — no aparece en ningún punto de la home ni del catálogo (revisado hasta el pie de página).
**Qué pasa:** los textos legales (aviso legal, privacidad, cookies, términos) existen como borrador en `Negoci/legal/`, pero no están conectados a la web: ni el banner de consentimiento, ni las páginas en sí, ni enlaces en el footer.
**Impacto en el usuario:** legal (RGPD/LSSI) antes que de diseño, pero también de producto — bloquea la activación del Meta Pixel, que está pendiente.
**Recomendación:** implementar banner + páginas + enlaces en footer. Ya hay contenido redactado, falta la parte de código.

**Corrección (verificado visualmente el 29/09):** el footer de `localhost:3000` ya tiene enlaces a Aviso legal, Política de privacidad, Política de cookies, Términos y condiciones y "Configurar cookies" — parece que esta parte se resolvió después de la auditoría. Lo que no se vio al cargar la home es el banner/popup de consentimiento en sí; confirmar si existe o si solo quedan los enlaces sueltos.

---

## [P1] Orden de catálogo por defecto

**Dónde:** `/catalogo`, sin filtro aplicado.
**Qué pasa:** el primer producto que se ve es una bata de laboratorio industrial ("CYCLONE"), sin relación aparente con despedidas, peñas o regalos de empresa.
**Impacto en el usuario:** primera impresión desalineada con el público objetivo real del negocio.
**Recomendación:** no es un bug de diseño sino de criterio de ordenación — decidir un orden por defecto (destacados, más vendidos, o categorías más relevantes primero) en vez del orden bruto que entrega el proveedor.

---

## [P2] Sin modo oscuro

**Dónde:** `src/app/globals.css`.
**Qué pasa:** existen variables de color bien montadas y nombradas (`--color-brand: #ef7904`, `--color-ink`, `--color-muted`, etc.), pero no hay ningún bloque `@media (prefers-color-scheme: dark)` que las redefina.
**Impacto en el usuario:** en un móvil con tema oscuro del sistema, la web se renderiza igual que en claro — no rompe nada, pero no se adapta.
**Recomendación:** bajo impacto, aplazable. Si se aborda, los tokens ya existentes facilitan el trabajo.

---

## [P2] Colores hardcodeados fuera del sistema de tokens

**Dónde:**
- `src/app/catalogo/page.tsx:110` — `stroke="#1A1310"` en un icono SVG
- `src/components/Header.tsx:55` — `stroke="#1A1310"` en el icono del menú
- `src/components/AddToCartForm.tsx:57` — `ctx.fillStyle = "#F4F1EC"` en un canvas

**Qué pasa:** mismos valores que ya existen como variable (`--color-ink`, `--color-muted`) pero escritos como hex suelto en vez de referenciar el token.
**Impacto en el usuario:** ninguno visible hoy — es deuda técnica que facilita que un futuro cambio de paleta deje estos tres puntos desincronizados.
**Recomendación:** sustituir por las variables CSS existentes. Cosmético, sin prisa.

---

## Valoración adicional (Claude, revisión visual en `localhost:3000` — 29/09, 12:13h)

Esto sí es inspección directa: navegué la home, el catálogo y dos fichas de producto (una gorra y una sobrecamisa) en el navegador. Corrige y amplía la auditoría original y mi primera ronda de comentarios (esa primera ronda especulaba sin haber visto la web — algunas cosas que asumí ahí, como que no había personalización, eran incorrectas y quedan corregidas aquí).

---

### [P1] Zonas de personalización no se adaptan al tipo de producto

**Dónde:** ficha de producto → botón "Con personalización".
**Qué pasa:** el configurador funciona bien (técnica de estampado, nº de colores, tamaño de área, subir logo, precio que se actualiza en vivo) — mejor de lo que esperaba. Pero las zonas ofrecidas son siempre las mismas tres: **Pecho, Espalda, Mangas**. En una sobrecamisa tiene sentido; en la gorra "Gorra original - 5 paneles" también aparecen esas mismas tres opciones, que no existen en una gorra (sería frontal, lateral, trasera).
**Impacto en el usuario:** para productos que no son prendas de manga (gorras, tazas, llaveros, bolsas) el selector de zona probablemente no encaje — riesgo de pedidos mal especificados o de que el cliente no sepa dónde marcar "aquí va el logo".
**Recomendación:** las zonas de estampado deberían depender de la categoría del producto, no ser un set fijo para todo el catálogo.

---

### [P2] Sin vista previa visual del logo colocado

**Dónde:** mismo configurador de personalización.
**Qué pasa:** subes tu archivo de logo pero no hay ningún mockup mostrando dónde queda ni a qué tamaño relativo. La home sí promete una "muestra digital" antes de fabricar ("Aprueba la muestra digital: te enviamos una previsualización con tu logo antes de fabricar nada") — parece que ese paso ocurre después, por email/manual, no en el momento de configurar.
**Impacto en el usuario:** ninguno crítico si la muestra por email realmente se envía siempre — pero conviene confirmar que ese paso no se salta nunca, porque en el propio configurador no hay ninguna garantía visual de ello.
**Recomendación:** aclarar en el propio configurador que "te mandaremos una muestra antes de fabricar" — ahora mismo esa promesa solo vive en una sección de la home, tres pantallas antes.

---

### [P0] Imagen principal del hero rota en la home

**Dónde:** home, columna derecha del hero, junto al titular "Regalos de empresa... personalizados con tu logo".
**Qué pasa:** el recuadro donde debería ir la imagen/mockup principal aparece vacío, con un patrón gris tenue de "imagen no cargada" — en desktop y tras recargar.
**Impacto en el usuario:** es lo primero que se ve al entrar a la web. Un hueco roto en el elemento visual más grande de la portada transmite lo contrario de "artesanía local de confianza".
**Recomendación:** revisar la fuente de esa imagen (ruta rota, `next/image` mal configurado, o asset que falta). Prioridad alta — es la primera impresión de toda la web.

---

### [P1] Teléfono de contacto con pinta de placeholder

**Dónde:** footer, columna "Contacto".
**Qué pasa:** aparece `+34 900 000 000` — un número redondo que parece dato de ejemplo, no el teléfono real del taller.
**Recomendación:** confirmar y sustituir por el número real antes de publicar; un placeholder visible en el footer es fácil de pasar por alto en el lanzamiento.

---

### [P1] Sin WhatsApp visible en la web

**Dónde:** home completa y footer (contacto solo lista email y teléfono).
**Por qué importa:** el brand kit fija el WhatsApp/DM como cierre estándar de la comunicación de marca ("Escríbenos por DM", "el DM sigue abierto") y es, según el brand kit, el canal real por el que se vende hoy. La web no lo menciona ni lo enlaza en ningún punto visitado.
**Recomendación:** añadir un enlace o botón de WhatsApp visible, sobre todo en catálogo y ficha de producto, donde el cliente ya está decidiendo.

---

### [P1] El footer contradice el propio precio del configurador

**Dónde:** footer, nota legal junto a "© 2026 Onion and Back".
**Qué pasa:** el footer dice "Precios sin IVA. **Personalización incluida según artículo**." Pero en la ficha de la sobrecamisa, activar personalización sube el precio de 22,99 € a 59,95 € — no está "incluida", se cobra aparte.
**Impacto en el usuario:** contradice justo la promesa de "sin sorpresas ni letra pequeña" del brand kit — es una letra pequeña que además es inexacta.
**Recomendación:** revisar esa frase del footer; probablemente aplicaba a una fase anterior del proyecto o a solo algunos artículos, y ahora mismo desinforma.

---

### [P1] Catálogo sin agrupación por evento o temporada

**Dónde:** `/catalogo`, filtro lateral de categorías.
**Qué pasa:** las categorías son por tipo de producto (Ropa, Escritura, Llaveros, Bolsas...), que es como está organizado el proveedor — pero no hay ninguna forma de navegar por ocasión: despedidas, peñas, Navidad, verano, vuelta al cole, bodas.
**Por qué importa:** según el brand kit, el mayor volumen de pedidos viene de peñas y despedidas, y el negocio vive de fechas y eventos concretos. Un cliente que busca "algo para la despedida de mi hermana" hoy tiene que traducir eso mentalmente a categorías de producto (¿ropa? ¿complementos?) en vez de encontrar una colección ya pensada para esa ocasión.
**Recomendación:** además del filtro por tipo de producto, añadir una navegación por evento/temporada (aunque sea una selección curada de 6-8 productos por ocasión, no todo el catálogo) — encaja también con el calendario de lanzamiento, que ya piensa en Halloween y fechas señaladas para el contenido.

---

### [P2] Tono de la copy es corporativo/genérico, no el de la marca

**Dónde:** hero ("Regalos de empresa y artículos publicitarios personalizados con tu logo"), sección de confianza ("Satisfacción 100% garantizada", "Entrega siempre en fecha", "Envío gratuito"), pasos del pedido ("Cuéntanos qué necesitas", "Aprueba la muestra digital", "Recibe tu pedido a tiempo").
**Qué pasa:** es texto correcto y claro, pero suena a cualquier tienda de merchandising B2B — nada distingue la voz de "el dueño de la tienda hablando en persona" que pide el brand kit (frases cortas, primera persona del plural, cierre de baja presión, nada de lenguaje corporativo).
**Impacto en el usuario:** no rompe la web, pero es una oportunidad perdida — la propia auditoría original señalaba que los nombres de categoría "rompen la sensación de trato cercano"; esta copy genérica tiene el mismo efecto a mayor escala, en el texto que más se lee.
**Recomendación:** no es urgente para el lanzamiento, pero antes de darlo por cerrado vale la pena pasar el hero y los tres bloques de confianza por el mismo filtro de voz que ya se aplica en Instagram.

---

### [P2] Sin señales de confianza en home

**Verificado:** la home sí tiene una sección "Por qué confiar en nosotros" con tres bloques (satisfacción garantizada, entrega en fecha, envío gratuito) — pero son garantías genéricas de cualquier ecommerce, no algo propio del negocio. No aparecen los 12 años, ni una foto real de una peña o empresa con su pedido, ni ninguna mención a la reputación local que es el activo real de la marca.
**Recomendación:** añadir al menos un bloque con los 12 años de trayectoria y/o una foto real de un pedido entregado — contenido barato de producir y de alto impacto en confianza, distinto de las garantías genéricas que ya están.

---

### [P2] Sin estado de "sin resultados"

**Por qué importa:** con ~30 categorías mal traducidas (punto 2 de la auditoría original) es fácil que alguien busque algo razonable ("camiseta peña", "sudadera despedida") y no haya match. Qué se ve en ese momento no está auditado.
**Recomendación:** revisar el estado vacío del buscador/filtro; si no existe uno diseñado, es fácil de pasar por alto hasta que un usuario real lo sufra.

---

### [P2] SEO básico no revisado

**Por qué importa:** para un lanzamiento, que Google indexe bien la home y las categorías principales importa tanto como el modo oscuro que sí se auditó (mismo nivel de esfuerzo, mayor retorno).
**Recomendación:** revisar `title`, meta description y `alt` de imágenes en home y catálogo antes del lanzamiento.

---

### [P2] Iconos SVG sin revisar accesibilidad

**Por qué importa:** el punto 6 de la auditoría original ya señala los iconos de `Header.tsx` y `catalogo/page.tsx` por el color hardcodeado — de paso, comprobar si llevan `aria-label` o `<title>`, porque un icono de menú o de filtro sin etiqueta es invisible para un lector de pantalla.
**Recomendación:** añadir `aria-label` a los iconos interactivos de esos mismos componentes, aprovechando que ya hay que tocarlos.

---

## Lo que ya funciona bien

- Catálogo real cargando con datos reales (5.091 productos, precios reales de Gorfactory) — nada de placeholders.
- Sistema de tokens de color coherente y bien nombrado en `globals.css`.
- Responsive limpio en la home: sin scroll horizontal, jerarquía tipográfica clara, CTA visible en el pliegue.
- Sin errores de consola ni peticiones de red rotas en ninguna de las páginas revisadas.

---

## Orden recomendado de arreglo (actualizado con la valoración adicional)

1. **P0** — Arreglar la imagen del hero rota en la home *(añadido, verificado)*
2. **P0** — Desplegable de categorías cerrado por defecto
3. **P1** — Corregir la frase del footer sobre personalización incluida *(añadido, verificado)*
4. **P1** — Zonas de personalización según tipo de producto, no un set fijo *(añadido, verificado)*
5. **P1** — Añadir WhatsApp visible en catálogo y ficha de producto *(añadido)*
6. **P1** — Sustituir el teléfono placeholder del footer *(añadido, verificado)*
7. **P1** — Agrupar el catálogo por evento/temporada, además de por tipo de producto *(añadido, a petición de Josep)*
8. **P1** — Normalizar nombres de categoría
9. **P1** — Confirmar si falta el banner de consentimiento de cookies (los enlaces del footer ya existen) *(corregido)*
10. **P1** — Orden de catálogo por defecto
11. **P2** — Vista previa visual del logo en el configurador *(añadido)*
12. **P2** — Señales de confianza reales (años, foto de pedido) en home *(añadido, verificado)*
13. **P2** — Revisar tono de la copy del hero y bloques de confianza *(añadido)*
14. **P2** — Estado de "sin resultados"
15. **P2** — SEO básico
16. **P2** — Modo oscuro
17. **P2** — Colores hardcodeados
18. **P2** — `aria-label` en iconos SVG

*Auditoría original realizada por Claude (sesión Claude Code) sobre `E:\onion\26\web`, rama `master`. Valoración adicional realizada por Claude en esta conversación, el 29 septiembre 2026: los puntos marcados "verificado" se comprobaron navegando `localhost:3000` en directo (home, catálogo, ficha de gorra y de sobrecamisa); el resto son observaciones de negocio/marca sin verificar en código, y el punto de agrupación por evento/temporada lo pidió Josep expresamente.*
