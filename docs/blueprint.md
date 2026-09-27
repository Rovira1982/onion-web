# Onion and Back — Blueprint

> Generado por El Arquitecto (adaptado) tras auditoría del proyecto existente y entrevista con el negocio.
> Fecha: 2026-09-27
> Alcance: **Reestructuración** — se conserva lo que funciona (motor de precios, diseño de marca, arquitectura Next.js), se sustituye la capa de datos (CSV estático → multi-proveedor con base de datos), se añade lo nuevo (carrito con pago, diseñador visual, cuentas, panel de producción).
> Estado del proyecto existente: en producción — https://web-production-050dc.up.railway.app · repo https://github.com/Rovira1982/onion-web

---

## 1. Visión general y no-objetivos

### Visión
Onion and Back vende dos tipos de producto a un público muy amplio (empresas, particulares, colegios, asociaciones, equipos deportivos, para bodas/comuniones/despedidas/eventos): **artículos de regalo promocional** comprados a mayoristas (Cifra, y en el futuro Makito y otros) y **prendas textiles en blanco** que ellos mismos personalizan mediante estampación (DTF subcontratado, serigrafía, vinilo, sublimación — con un motor de precios propio y verificado). La web debe mostrar todo el catálogo combinado de varios proveedores, calcular el precio real de la personalización, y cobrar siempre por adelantado — el problema de negocio que resuelve es el **cashflow**: hoy la empresa no puede permitirse adelantar dinero a proveedores antes de cobrar al cliente.

### Usuarios
| Persona | Qué viene a hacer | Frecuencia |
|---|---|---|
| Empresa (regalo corporativo / uniformes) | Buscar productos, pedir varias unidades con su logo, pagar | Recurrente |
| Particular (boda, comunión, despedida, regalo puntual) | Comprar pocas unidades, a veces personalizadas | Puntual |
| Colegio / asociación / equipo deportivo | Pedido grande con nombres/dorsales individuales por persona | Estacional/recurrente |
| Onion and Back (admin) | Ver pedidos pagados, tramitarlos con el proveedor correspondiente, imprimir la hoja de trabajo para el operario | Diaria |

### Objetivos — alcance v1
1. Catálogo unificado navegable por **tipo de producto** (Ropa Laboral, Ropa Deportiva, Regalo Promocional) y por **ocasión** (bodas, despedidas, eventos, colegios...), alimentado por múltiples proveedores.
2. Carrito con **pago obligatorio por adelantado** (tarjeta/Bizum vía Redsys, o transferencia con confirmación manual).
3. Presupuestador de estampación con el modelo de marcas múltiples ya especificado (ver §4 y Anexo A).
4. Diseñador visual interactivo: el cliente coloca su logo sobre un mockup real de la prenda antes de pagar.
5. Cuentas de cliente con historial de pedidos y diseños guardados, con consentimiento de marketing capturado desde el registro.
6. Panel de administración: pedidos pagados por estado de producción (Pendiente → En diseño → En aprobación → En producción → Terminado → Entregado), con **hoja de trabajo imprimible** por pedido (nombres/tallas individuales + imagen del diseño).
7. Exportación de pedidos a CSV compatible con la importación de FactuSol.

### No-objetivos — explícitamente fuera de v1
| No se construye | Por qué no ahora | Revisar cuando |
|---|---|---|
| Pago a proveedores automatizado | Se paga al contado manualmente a cada proveedor (Cifra, Gorfactory, Makito...); no hay API de pago de proveedor que lo justifique | Si algún proveedor ofrece pago automatizado por API |
| Pedido automático a Cifra | Cifra no tiene API de pedidos, solo catálogo | Si Cifra publica una API de pedidos |
| Pedido automático a Gorfactory | La API existe y ya está programada (`src/lib/gorfactory.ts`), pero Gorfactory no ha activado el acceso en la cuenta | En cuanto Gorfactory confirme la activación |
| Pago fraccionado / financiación al cliente | No se ha pedido, añade complejidad de checkout | Si se pide explícitamente |
| Giro a 30 días automatizado para empresas | Se gestiona manualmente y caso a caso, fuera del flujo estándar | Si el volumen de clientes B2B recurrentes lo justifica |
| Seguimiento de horas de empleados en la web | Se mantiene en un Excel aparte, decisión explícita del negocio | Si se decide centralizarlo más adelante |
| Sincronización con Mailchimp | Mencionado como plan futuro, no se activa en v1 — solo se captura el consentimiento para no tener que volver a pedirlo | Cuando decidáis activar campañas |
| Rediseño completo del presupuestador (marcas múltiples) implementado en la interfaz | La especificación ya está cerrada (Anexo A) pero se construye dentro de esta reestructuración, no antes | Paso 6 del orden de implementación (§9) |

### Métricas de éxito
| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| % de pedidos pagados antes de producción | 100% | Todo pedido en BD tiene `estado_pago = pagado` antes de pasar a `en_produccion` |
| Tiempo medio de generar un presupuesto | < 2 min | Analítica de uso en `/presupuesto` |
| Productos indexados por Google | Sitemap con >5.000 URLs de producto | Search Console |

---

## 2. Stack tecnológico

| Capa | Elección | Por qué, frente a qué |
|---|---|---|
| Framework | **Next.js 16 (App Router)** — se conserva | Ya en producción, funciona bien, sin motivo técnico para cambiar |
| Estilos | **Tailwind CSS v4** — se conserva | Ya aplicado con la marca real |
| Lenguaje | **TypeScript** — se conserva | Ya en uso |
| Base de datos | **PostgreSQL** (addon nativo de Railway, mismo proveedor de hosting) — nuevo | Sustituye al CSV estático; soporta pedidos, cuentas, catálogo multi-proveedor y diseños guardados |
| ORM | **Prisma** — nuevo | Tipado, migraciones controladas, encaja con Next.js/TS |
| Autenticación | **Auth.js (NextAuth)** — nuevo, email+contraseña, ampliable a Google | Estándar, sin coste, suficiente para v1 |
| Pagos | **Redsys** (Tarjeta + Bizum) + Transferencia manual — nuevo | Coincide con el banco del negocio (Santander); Bizum vía el mismo contrato |
| Almacenamiento de archivos | **Cloudflare R2** (compatible S3) — nuevo | Logos subidos por clientes en el diseñador; Railway no tiene almacenamiento de archivos propio |
| Editor visual | **Konva.js** sobre `<canvas>` — nuevo | Arrastrar/ajustar logo sobre mockup, estándar para este tipo de editor |
| Email transaccional | **Resend** — ya integrado en código, falta activar cuenta | Ya programado en `src/app/api/contact/route.ts` |
| Proveedor de estampación externo | Tercero de DTF (nombre pendiente de confirmar contractualmente) | Ya contemplado en el modelo de precios (Anexo A) |
| Hosting | **Railway** — se conserva | Ya desplegado, con auto-deploy desde GitHub funcionando |
| Gestión de horas/nómina | Excel externo (fuera de la web) | Decisión explícita del negocio |
| Facturación | **FactuSol** (externo, local) — la web exporta CSV compatible | FactuSol no tiene API accesible desde la nube |

### Comprobación de compatibilidad
Next.js 16 + Prisma + PostgreSQL + Auth.js es una combinación muy extendida y sin incompatibilidades conocidas. Redsys se integra vía redirección/formulario firmado (SHA-256), no requiere SDK de cliente pesado — compatible con App Router sin fricción. Cloudflare R2 usa API compatible S3, cualquier SDK de S3 sirve.

---

## 3. Estructura de directorios (objetivo, tras la reestructuración)

```
onion-web/
  prisma/
    schema.prisma              # Modelo de datos completo (§4)
    migrations/                 # Migraciones versionadas
    seed.ts                     # Datos de arranque (categorías, admin de prueba)
  src/
    app/
      (shop)/
        page.tsx                # Home
        catalogo/page.tsx        # Listado multi-proveedor, filtro categoría/ocasión
        producto/[slug]/page.tsx  # Ficha con selector talla/color
      (checkout)/
        carrito/page.tsx          # Carrito
        checkout/page.tsx          # Pago (Redsys)
        pedido/[id]/confirmacion/page.tsx
      (cuenta)/
        login/page.tsx
        registro/page.tsx
        mi-cuenta/
          pedidos/page.tsx
          disenos/page.tsx
      presupuesto/page.tsx        # Calculadora (mismo motor, UI nueva de marcas múltiples)
      disenador/[productId]/page.tsx  # Editor visual del logo
      admin/
        pedidos/page.tsx           # Panel de producción
        pedidos/[id]/parte-trabajo/page.tsx  # Hoja imprimible
      api/
        contact/route.ts           # Ya existe
        auth/[...nextauth]/route.ts
        checkout/route.ts
        webhooks/redsys/route.ts
        admin/pedidos/export/route.ts  # CSV para FactuSol
    components/                  # Header, Footer, ProductCard, VariantPicker (se conservan)
    lib/
      pricing.ts                 # Motor de precios — se conserva, se amplía (Anexo A)
      db.ts                       # Cliente Prisma
      auth.ts                     # Config Auth.js
      payments/redsys.ts           # Integración Redsys
      storage/r2.ts                # Subida de logos
      suppliers/
        index.ts                   # Interfaz común SupplierAdapter
        cifra.ts                    # Adaptador Cifra (CSV)
        gorfactory.ts                # Adaptador Gorfactory (API) — se conserva, se adapta
        makito.ts                    # (cuando esté disponible)
      products.ts                 # Capa de catálogo — pasa de leer CSV a leer BD
  data/
    cifra-products.csv            # Se conserva como fuente de importación puntual, no en runtime
  docs/
    blueprint.md                   # Este documento
    gorfactory-api-v1.json          # Se conserva
```

**Reglas de límites**
- Solo `src/lib/suppliers/*` puede parsear/consultar la fuente cruda de un proveedor. El resto del código solo habla con `src/lib/products.ts`.
- Solo `src/lib/db.ts` abre conexión a la base de datos.
- El editor visual (`disenador/`) escribe la configuración del diseño a la BD; nunca al sistema de archivos local.

---

## 4. Modelo de datos

### Entidades principales

**Supplier** — un proveedor de catálogo (Cifra, Gorfactory, Makito, Roly, TopTex, Joma...)
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| name | text | unique | |
| adapterKey | text | not null | referencia al adaptador en `lib/suppliers/` |
| active | boolean | default true | |

**Category** — Ropa Laboral / Ropa Deportiva / Regalo Promocional (+ subcategorías)
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| name | text | not null | |
| slug | text | unique | |
| parentId | uuid | FK → Category, nullable | subcategorías |

**Occasion** — bodas, despedidas, eventos, colegios... (etiqueta transversal, no excluyente con Category)
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| name | text | unique | |
| slug | text | unique | |

**Product** — producto agregado (ya no es una fila CSV, es la entidad normalizada)
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| supplierId | uuid | FK → Supplier | |
| supplierSku | text | not null | referencia externa del proveedor |
| name | text | not null | |
| description | text | | |
| categoryId | uuid | FK → Category | |
| basePrice | numeric(10,2) | not null | |
| material | text | | |
| stock | integer | default 0 | |
| lastSyncedAt | timestamp | not null | de la última sincronización con el proveedor |

**ProductVariant** — talla/color de un producto
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| productId | uuid | FK → Product | |
| size | text | nullable | |
| color | text | nullable | |
| price | numeric(10,2) | not null | puede diferir del basePrice (ej. 3XL más caro) |
| stock | integer | default 0 | |
| supplierModelCode | text | not null | código real del proveedor, para trazabilidad |

**ProductImage**, **ProductOccasion** (join Product↔Occasion) — tablas de apoyo, ver esquema Prisma completo.

**User**
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| email | text | unique, not null | |
| passwordHash | text | nullable | null si login social |
| marketingConsent | boolean | default false | capturado en registro, para Mailchimp futuro |
| role | enum(cliente, admin, operario) | default cliente | |

**Order**
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| userId | uuid | FK → User, nullable | nullable si se permite invitado más adelante |
| status | enum | not null, default `pendiente_pago` | ver Estados abajo |
| priority | enum(vencido, critico, alta, media, baja) | calculado | según fecha de entrega objetivo |
| paymentMethod | enum(tarjeta, bizum, transferencia) | not null | |
| paymentStatus | enum(pendiente, pagado, fallido) | not null | |
| deliveryTargetDate | date | nullable | |
| total | numeric(10,2) | not null | |
| createdAt | timestamp | not null | |

**Estados de Order** (réplica de `Leyenda_Estados` del Excel): `pendiente_pago` → `pagado` → `en_diseno` → `en_aprobacion` → `en_produccion` → `terminado` → `entregado`.

**OrderLine** — una línea de pedido (equivalente a la hoja `Pedidos` del Excel: permite nombre/talla individual por unidad)
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| orderId | uuid | FK → Order | |
| productVariantId | uuid | FK → ProductVariant, nullable | nullable si es 100% estampación sin catálogo |
| quantity | integer | not null | |
| individualName | text | nullable | nombre de la persona (equipaciones) |
| individualNumber | text | nullable | dorsal |
| unitPrice | numeric(10,2) | not null | precio final ya calculado (presupuestador) |

**DesignConfig** — la configuración del diseñador visual, one-to-one con OrderLine
| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| orderLineId | uuid | FK → OrderLine, unique | |
| logoFileUrl | text | not null | URL en Cloudflare R2 |
| markings | jsonb | not null | lista de marcas (zona, posición, tamaño, técnica) — ver Anexo A |
| previewImageUrl | text | not null | mockup renderizado, usado en la hoja de trabajo |

### Relaciones
- Supplier —(1:N)→ Product —(1:N)→ ProductVariant
- Product —(N:1)→ Category; Product —(N:M)→ Occasion
- User —(1:N)→ Order —(1:N)→ OrderLine —(1:1)→ DesignConfig
- Cascade: borrar un Order borra sus OrderLine y DesignConfig (`ON DELETE CASCADE`). Borrar un Product **no** borra pedidos pasados — `productVariantId` en OrderLine queda `SET NULL` para preservar el histórico de qué se vendió aunque el producto se retire del catálogo.

### Índices
| Tabla | Índice | Por qué |
|---|---|---|
| Order | `status, priority` | Listado del panel de admin, ordenado por urgencia |
| Product | `categoryId, supplierId` | Filtro de catálogo |
| ProductVariant | `productId` | Carga de variantes en ficha de producto |

### Migraciones
Prisma Migrate, convención `NNN_descripcion`. Nunca una migración destructiva (`DROP COLUMN`, `DROP TABLE`) en el mismo despliegue que el cambio de código que deja de usar esa columna — primero se deja de usar, se despliega, y solo en un paso posterior se elimina.

### Datos semilla
Las 3 categorías (Ropa Laboral, Ropa Deportiva, Regalo Promocional), las ocasiones (bodas, despedidas, comuniones, eventos, colegios), y un usuario admin de prueba.

---

## 5. Diseño de API

### Convenciones
- Base: rutas de Next.js App Router (`/api/...`), sin prefijo de versión por ahora (proyecto de un solo cliente, no una API pública).
- Respuesta de error: `{ error: string, code: string }` siempre; éxito: forma específica por endpoint.
- Validación: `zod`, esquemas junto a cada route handler.

### Rutas críticas

**`POST /api/checkout`** — crea el pedido y la sesión de pago
- Entrada: carrito (líneas con producto/variante/cantidad/config de diseño), método de pago, dirección.
- Validaciones: stock disponible por variante, cliente autenticado o registro obligatorio en este paso.
- Efectos: crea `Order` + `OrderLine` en estado `pendiente_pago`, genera la petición firmada a Redsys, devuelve la URL de redirección.
- Errores: `400 STOCK_INSUFICIENTE`, `400 CARRITO_VACIO`, `401 NO_AUTENTICADO`.

**`POST /api/webhooks/redsys`** — notificación de pago de Redsys
- Verifica la firma SHA-256, marca `Order.paymentStatus = pagado`, `Order.status = pagado` → dispara email de confirmación (Resend).
- Idempotente: si ya está marcado como pagado, no duplica el efecto.

**`POST /api/disenos`** — guarda la configuración del diseñador visual
- Entrada: logo (sube primero a R2 vía URL prefirmada), lista de marcas con posición/tamaño/técnica.
- Efectos: crea `DesignConfig`, genera `previewImageUrl`.

**`GET /api/admin/pedidos/export`** — CSV para FactuSol
- Solo rol `admin`. Parámetros de rango de fechas. Devuelve CSV con las columnas que FactuSol espera en su importador.

---

## 6. Arquitectura frontend

### Rutas
| Ruta | Página | Origen de datos | Auth |
|---|---|---|---|
| `/` | Home | Server component, BD | Pública |
| `/catalogo` | Listado | Server component, BD, paginado | Pública |
| `/producto/[slug]` | Ficha | Server component, BD | Pública |
| `/presupuesto` | Calculadora | Client component (interactivo) | Pública |
| `/disenador/[productId]` | Editor visual | Client component (canvas) | Requiere cuenta |
| `/carrito`, `/checkout` | Compra | Client + server actions | Requiere cuenta en checkout |
| `/mi-cuenta/*` | Área cliente | Server component, BD | Requiere cuenta |
| `/admin/pedidos` | Panel producción | Server component, BD | Rol admin |

### Estrategia de renderizado
Catálogo y fichas: server-rendered con revalidación cada pocos minutos (los datos cambian por sincronización de proveedor, no en tiempo real). Carrito, checkout, diseñador: cliente, con acciones de servidor (`server actions`) para las mutaciones. Panel admin: server-rendered, sin caché (datos siempre frescos).

### Jerarquía de componentes (diseñador, la pieza nueva más compleja)
```
DisenadorPage (server: carga producto + variantes)
  └─ DesignerCanvas (client)
       ├─ GarmentMockup (imagen base según color/talla elegidos)
       ├─ LogoUploader
       ├─ MarkingLayer (uno por marca activa: bolsillo izq/der, diafragma, espalda...)
       └─ PriceSummary (llama a pricing.ts en vivo mientras se edita)
```

### Estado
Carrito: estado de servidor (tabla `Order` en `pendiente_pago` hasta checkout, no localStorage — así sobrevive a cambios de dispositivo si el cliente tiene cuenta). Estado del editor visual: local (React state) hasta guardar. Sin librería de estado global — no hace falta con Server Components + acciones de servidor.

### Estados de carga, vacío y error
Catálogo vacío (filtro sin resultados): ya existe, se conserva. Carrito vacío: mensaje + CTA al catálogo. Fallo de pago Redsys: página de error con reintento y contacto directo.

---

## 7. Sistema de diseño

*(Ya implementado y en producción — se documenta el estado actual, no cambia con la reestructuración salvo nuevos componentes del carrito/diseñador que deben seguir estos mismos valores.)*

### Colores
| Token | Valor | Uso |
|---|---|---|
| `--color-brand` | `#EF7904` | Botones primarios, acentos, precio destacado |
| `--color-brand-dark` | `#C76202` | Hover de botones |
| `--color-brand-light` | `#FFF1E2` | Fondos de sección, hero |
| `--color-ink` | `#1A1310` | Texto principal |
| `--color-ink-soft` | `#4A423D` | Texto secundario |
| `--color-muted` | `#FAF5F0` | Fondos de tarjeta/sección alterna |
| `--color-border` | `#ECE2D8` | Bordes, divisores |

Extraído directamente del logo real de la marca (muestreado en píxeles del archivo de marca, no aproximado).

### Tipografía
| Rol | Familia | Uso |
|---|---|---|
| Display / títulos | Rubik (500-800) | H1-H4, precios, botones |
| Cuerpo | Nunito Sans (400-800) | Texto de párrafo, labels |

### Componentes
Estilo: bloques redondeados (`rounded-2xl`/`rounded-3xl`), sombras suaves solo en hover, sin gradientes ni glassmorphism — coherente con una marca artesanal/cercana, no corporativa fría. Los componentes nuevos (carrito, diseñador, panel admin) deben mantener esta misma paleta y radios, no introducir un lenguaje visual distinto.

### Movimiento
Transiciones de 150-300ms en hover/estado, sin animaciones complejas — con los skills de Emil Kowalski ya instalados (`animate`, `emil-design-eng`) disponibles para pulir el diseñador visual, que sí necesita interacción más rica (arrastrar/soltar el logo).

---

## 8. Autenticación y autorización

### Proveedor
Auth.js (NextAuth) con proveedor de credenciales (email+contraseña) para v1; Google como proveedor adicional queda preparado pero no es obligatorio para el lanzamiento.

### Flujos
Registro (con casilla de consentimiento de marketing) → verificación de email → primera pantalla útil (catálogo). Login, recuperación de contraseña, cierre de sesión, baja de cuenta — todos con sus ramas de error.

### Protección de rutas
| Superficie | Regla | Dónde se aplica |
|---|---|---|
| `/checkout` | Autenticado | Middleware + comprobación en la acción de servidor |
| `/mi-cuenta/*` | Autenticado, propio usuario | Comprobación de `userId` en cada query |
| `/admin/*` | Rol = admin | Middleware + comprobación en cada route handler |

**Regla:** toda autorización se comprueba en servidor. Ningún botón oculto en cliente sustituye una comprobación real.

### Roles
| Rol | Puede | No puede |
|---|---|---|
| Cliente | Ver/editar su cuenta, comprar, ver sus pedidos y diseños | Ver pedidos de otros, acceder al panel admin |
| Admin | Todo lo de cliente + panel de producción, exportar CSV | — |
| Operario (futuro) | Ver hoja de trabajo de pedidos asignados | Modificar precios o datos de cliente |

### Sesiones
JWT de sesión, cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Sin necesidad de aislamiento multi-tenant (un solo negocio).

---

## 9. Orden de implementación

1. **Base de datos y Prisma** — esquema completo (§4), migraciones, seed. Sin esto nada más puede avanzar.
2. **Capa de proveedores (`lib/suppliers/`)** — adaptador Cifra (migra el CSV actual a la BD), adaptador Gorfactory (reutiliza `lib/gorfactory.ts` ya escrito). `lib/products.ts` pasa a leer de BD en vez de CSV.
3. **Categorías nuevas** (Ropa Laboral / Ropa Deportiva / Regalo Promocional) + navegación por ocasión — reetiqueta el catálogo migrado.
4. **Autenticación** — registro/login, consentimiento de marketing.
5. **Carrito y checkout con Redsys** — el cambio de negocio más crítico (resuelve el cashflow).
6. **Presupuestador — modelo de marcas múltiples** (Anexo A) — sustituye la lógica actual de zona única por técnica.
7. **Diseñador visual** — depende del presupuestador nuevo (necesita saber qué marcas/posiciones existen).
8. **Panel de administración + hoja de trabajo imprimible** — depende de que existan pedidos reales con diseño adjunto.
9. **Exportación CSV a FactuSol**.
10. **SEO por producto + sitemap.xml + robots.txt** — puede hacerse en paralelo con el resto, no depende de nada.
11. **Páginas legales** (Aviso Legal, Privacidad, Cookies, Términos) — requiere datos fiscales del negocio.

Cada paso debe dejar la web funcionando (nunca un estado roto entre pasos) — el catálogo actual sigue funcionando con CSV hasta que el paso 2 lo sustituya limpiamente.

---

## 10. Configuración de entorno

Variables nuevas a añadir a `.env.local` / Railway (además de las ya existentes `GORFACTORY_*`, `RESEND_*`):
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
REDSYS_MERCHANT_CODE=
REDSYS_TERMINAL=
REDSYS_SECRET_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

---

## 11. Dependencias nuevas

`prisma`, `@prisma/client`, `next-auth`, `@auth/prisma-adapter`, `zod`, `konva` + `react-konva`, `@aws-sdk/client-s3` (compatible R2), `resend` (ya instalado, pendiente de activar cuenta).

---

## 12. Estrategia de despliegue

Se conserva Railway con auto-deploy desde `main` en GitHub (ya configurado y funcionando). Las migraciones de Prisma se ejecutan como paso de build (`prisma migrate deploy`) antes de arrancar la app — nunca a mano en producción.

---

## 13. Estrategia de pruebas

Dado el tamaño del equipo, priorizar pruebas manuales guiadas por checklist en los puntos críticos: cálculo de precio (contra los casos reales del Excel, como ya se hizo), flujo de pago completo en modo test de Redsys antes de activar producción, y verificación visual del diseñador en móvil y escritorio.

---

## 14. Seguridad y secretos

Todas las claves en variables de entorno (Railway), nunca en el repositorio (ya es la práctica actual). El webhook de Redsys valida la firma antes de marcar cualquier pedido como pagado. Límite de frecuencia en `/api/checkout` y `/api/contact` para evitar abuso.

---

## 15. Accesibilidad

Se mantienen las prácticas ya aplicadas (contraste, tamaños táctiles). El diseñador visual necesita atención específica: debe ser operable por teclado (mover el logo con flechas, no solo arrastrar con ratón) para cumplir WCAG 2.2 AA.

---

## 16. Riesgos técnicos y decisiones pendientes

| Riesgo / decisión pendiente | Impacto | Mitigación |
|---|---|---|
| Coste real del DTF subcontratado puede variar por proveedor | Precio de presupuesto incorrecto | Confirmado: 9€/m² coste real, 11€/m² ya facturado (2€ de margen incluido) — no tocar sin confirmación |
| Ajuste del mínimo de Sublimación 11-30 uds | Márgenes de ese tramo | Valor provisional 4,4€/ud aplicado y desplegado — pendiente de cifra definitiva del negocio |
| Diafragma tratado como tamaño 23×23 | Precio ligeramente impreciso si el tamaño real difiere | Aceptado como aproximación por el negocio; revisar si se detectan quejas de precio |
| Gorfactory sigue bloqueado por el proveedor | El adaptador está listo pero sin datos en vivo | Repetir la prueba de conexión periódicamente hasta que activen el acceso |
| FactuSol no tiene API | No hay sincronización automática de facturación | Exportación CSV manual, ya aceptado como solución |
| Nuevos proveedores (Makito, Roly, TopTex, Joma/Rasan/Kelme) aún no confirmados | La arquitectura de adaptadores está lista, pero cada uno necesitará su propio adaptador cuando se firme el acceso | Construir cada adaptador cuando el proveedor esté confirmado, no antes |

---

## Anexo A — Especificación del presupuestador (marcas múltiples)

*Cerrada en la entrevista, pendiente de implementar en el paso 6 de §9. No implementar antes — depende de la base de datos y está pensada para encajar con el diseñador visual.*

### Modelo de zonas
- **Pecho**: hasta 3 marcas independientes — bolsillo izquierdo (10×10), bolsillo derecho (10×10), diafragma (≈22×22, tratado como el tamaño 23×23 existente).
- **Espalda**: hasta 3 marcas independientes — nombre individual, dorsal, logo abajo.
- **Mangas**: sin cambios respecto al modelo actual.

Cada marca es una entrada independiente con su propia técnica, tamaño y coste — el total del presupuesto es la suma de todas las marcas activas. Si el negocio marca "2 logos en el pecho", se cobran como 2 marcas completas aunque en producción sea una sola pantalla/pasada — decisión explícita del negocio, no optimizar el coste por eficiencia de producción.

### Técnicas por tipo de marca
- **Logos principales** → DTF (proveedor externo). Fórmula: `coste = ancho_m × alto_m × 9€` (coste real del proveedor) facturado internamente a 11€/m² (margen de 2€/m² ya incluido — no bajar este número).
- **Nombre individual** → Vinilo (en casa). Cargo: **2€/unidad**.
- **Dorsal** → Vinilo (en casa). Cargo: **3€/unidad**.
- Si el pedido lleva nombre y dorsal a la vez, se suman (5€/unidad) — no hay descuento por combinarlos.

### Motivo de mantener vinilo para nombre/dorsal
El DTF es de un proveedor externo — usarlo para algo tan repetitivo como nombres y dorsales de equipaciones añadiría dependencia y tiempos de espera innecesarios. El vinilo se mantiene en casa, con control total, para este caso de uso concreto.

### Correcciones ya aplicadas al motor actual (desplegadas en producción, `src/lib/pricing.ts`)
- Serigrafía: se corrigió el doble cobro de pantalla (antes se sumaba dos veces).
- Sublimación 11-30 uds: mínimo corregido de 1,75€ a 4,4€/ud (provisional).

---

## Anexo B — Migración del proyecto existente

### Qué se conserva intacto
- `src/lib/pricing.ts` — motor de precios, verificado contra el Excel real del negocio.
- Diseño de marca completo (colores, tipografías, componentes Header/Footer/ProductCard/VariantPicker).
- Arquitectura Next.js/Tailwind/TypeScript y el despliegue en Railway con auto-deploy ya funcionando.
- El cliente de Gorfactory (`src/lib/gorfactory.ts`) — se reutiliza tal cual dentro de la nueva capa de adaptadores.
- El razonamiento de agrupación de productos por nombre+categoría (la lógica de `products.ts` que resolvió los "modelo raíz" inconsistentes de Cifra) — se traslada al adaptador de Cifra, no se descarta.

### Qué se sustituye
- CSV estático (`data/cifra-products.csv` en runtime) → PostgreSQL + adaptadores por proveedor. El CSV se conserva como fuente de una importación puntual inicial, no se sigue leyendo en producción.
- Formulario de contacto como único canal de conversión → checkout completo con pago real.
- Modelo de precio de "zona única por técnica" en el presupuestador → modelo de marcas múltiples (Anexo A).

### Qué se desarrolla desde cero
Cuentas de cliente, carrito, integración Redsys, diseñador visual, panel de administración con hoja de trabajo imprimible, exportación CSV a FactuSol, páginas legales, SEO por producto.

### Qué datos/contenidos migran
- Las 6.145 filas de `data/cifra-products.csv` se importan a `Product`/`ProductVariant` en el paso 2 — una sola vez, vía script de importación, no en cada arranque.
- El histórico de correcciones de negocio ya hechas (agrupación por nombre, tallas/colores extraídos del código de modelo) se conserva en la lógica del adaptador, no se repite el trabajo de depuración.

### Riesgos técnicos de la migración
Ver §16. El mayor riesgo real es el coste de DTF y el mínimo de Sublimación, ya mitigados con valores provisionales correctos y documentados.

### Orden de implementación recomendado
Ver §9 — es el mismo orden, pensado explícitamente para que cada paso deje la web funcionando sin romper lo que ya está en producción.
