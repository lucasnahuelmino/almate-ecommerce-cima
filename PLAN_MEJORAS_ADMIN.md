# PLAN DE MEJORAS DEL PANEL DE ADMINISTRACIÓN — CIMA

> Documento central de planificación y seguimiento.
> Estado de las etapas: **pendiente** · **en curso** · **bloqueada** · **completada**
> Última actualización: 2026-10-23 (Etapa 1 completada: catálogo visual y edición individual)

---

## 1. Auditoría inicial (Fase 0 — COMPLETADA)

Se inspeccionó el código real del repositorio antes de planificar. Nada de lo que sigue está supuesto: todo fue leído y verificado.

### 1.1 Arquitectura detectada

| Capa | Tecnología real | Archivos |
|------|------------------|----------|
| Tienda pública | HTML + CSS + JS vanilla, sin frameworks ni build | `index.html`, `tienda.html`, `js/pages/*`, `js/core/*` |
| Panel de administración | HTML + JS vanilla (sin framework), servido por el backend | `server/admin/index.html`, `admin.js`, `admin.css` |
| Backend | Node.js ≥ 20, Express 5 | `server/app.js`, `server/index.js` |
| Base de datos | SQLite (better-sqlite3), modo WAL | `server/db.js` → `server/data/orders.sqlite` |
| Pagos | SDK oficial `mercadopago` (solo credenciales TEST) | `server/services/checkout.js`, `mercadopago.js` |
| Autenticación | Contraseña en variable de entorno, sesiones propias | `server/admin-auth.js` |
| Pruebas | `node:test` (30 pruebas) | `server/test/*.test.js` |

**Dependencias actuales** (todas y solo estas): `better-sqlite3`, `cors`, `dotenv`, `express`, `mercadopago`.

### 1.2 Esquema de la base de datos (verificado en `server/db.js`)

Tablas existentes:

- `categories` — datos en JSON.
- `products` — columnas `id`, `slug`, `sku` (únicos), `category_id`, `active`, `sort_order`, y `data` (JSON completo del producto).
- `orders` — pedidos con estado de pago.
- `inventory_reservations` — stock reservado por pedidos pendientes (expira solo).
- `inventory_movements` — ventas confirmadas (descuentan stock).
- `payment_events`, `order_fulfillment`, `order_audit`, `email_notifications`, `order_admin_events`.

**Concepto clave de stock** (muy importante para no romper nada):

- En el JSON del producto, `stock` es el stock **físico total**.
- El stock **disponible** = `stock` − vendido (`inventory_movements`) − reservado activo (`inventory_reservations`).
- La importación CSV actual ya respeta esto: guarda `stock + vendido` y rechaza bajar por debajo de reservas activas. Cualquier edición individual o masiva debe hacer lo mismo.

### 1.3 Funcionalidades ya implementadas (no se deben duplicar ni reemplazar)

**Autenticación y seguridad (`server/admin-auth.js`, `admin-router.js`)**
- Contraseña obligatoria (mínimo 16 caracteres) con hash scrypt; sin contraseña, `/admin` devuelve 404.
- Sesión con cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción, duración 1 hora.
- Token CSRF por sesión obligatorio en toda mutación.
- Verificación de origen (same-origin) en mutaciones.
- Límite de 5 intentos de login fallidos cada 15 minutos por IP.
- Cabeceras de seguridad en el panel: CSP estricta (`default-src 'self'`, sin scripts inline), `no-store`, `X-Frame-Options: DENY`.
- Toda la ruta `/api/admin/*` exige sesión.

**Pedidos (`server/admin-router.js`, `db.js`, `admin/admin.js`)**
- Listado paginado de pedidos con datos mínimos del cliente (sin DNI).
- Cambio de estado operativo (preparación/entrega) con transiciones válidas y auditoría en `order_audit`.
- Cancelación de pedidos WhatsApp con liberación de reserva de stock y registro en `admin_order_events`.
- Estado de pago separado del estado operativo; solo se prepara pedidos pagados.

**Catálogo por CSV (`server/services/catalog-admin.js`)**
- Exportación: `GET /api/admin/catalog.csv` (18 columnas).
- Vista previa: `POST /api/admin/catalog/preview` (no escribe).
- Importación: `POST /api/admin/catalog/import` (transaccional, todo o nada).
- Validaciones ya existentes: duplicados de ID/SKU/slug, categoría inexistente, stock menor que reservas activas, formato de variantes/specs, longitud de descripciones, rutas de imagen inseguras (`javascript:`, `data:`, `..`).
- Respeto de ventas históricas al reimportar.

**Backend público (`server/app.js`)**
- `GET /api/products`, `GET /api/products/:slug` (solo activos, con stock disponible).
- `POST /api/checkout` (Mercado Pago TEST), `POST /api/orders/whatsapp`, webhook con validación de firma, `GET /api/orders/:id`.

**Pruebas existentes:** 30 pruebas automatizadas. **Ejecutadas durante esta auditoría: 30/30 pasaron.**

### 1.4 Hallazgos importantes (condicionan el plan)

1. **La tienda pública hoy NO consume el catálogo del backend.** `js/config.js` tiene `catalog.apiBaseUrl: ""` vacío. Mientras siga vacío, la tienda muestra los datos del archivo `js/data/products.js` y **los cambios hechos desde el panel no se verán en la tienda** (aunque sí se guardan en la base de datos). Conectarlo es un cambio de una línea de configuración, pero afecta a la tienda pública, por eso requiere tu aprobación explícita (ver sección 8).
2. **No existe sistema de subida de imágenes.** Hoy las imágenes son rutas de archivos dentro de la carpeta `img/` del frontend, servidas por el hosting estático. El backend no recibe, guarda ni sirve imágenes. La CSP del panel solo permite mostrar imágenes del mismo origen del backend, así que las imágenes subidas desde el panel deberían vivir en el backend y servirse desde ahí.
3. **No existe borrado de productos** en ninguna parte del sistema (ni endpoint ni UI). Solo se puede desactivar vía CSV.
4. **No existe edición individual de productos** (solo la importación CSV completa).
5. **No existe registro de auditoría del catálogo** (solo hay auditoría de cambios de estado de pedidos).
6. **No existen respaldos** automáticos de la base de datos.
7. **El arranque del servidor sincroniza categorías desde `js/data/categories.js`** (las sobrescribe) e inserta productos nuevos sin tocar los existentes. Por eso los cambios de precios/stock del panel sobreviven reinicios, pero una futura edición de categorías desde el panel se perdería al reiniciar (aún no hay edición de categorías, queda anotado).
8. **Las sesiones viven en memoria**: un reinicio del servidor cierra la sesión del administrador (es un comportamiento seguro, no se cambia).
9. **No hay migraciones versionadas**: el esquema se crea con `CREATE TABLE IF NOT EXISTS`. Agregar tablas nuevas de forma incremental es compatible y es el camino previsto.
10. **No existe archivo `.env` ni base de datos local** en este momento (`server/data/` no existe), así que no hay datos reales locales en riesgo durante el desarrollo. Las pruebas usan bases en memoria.

---

## 2. Funcionalidades existentes vs. faltantes

| Etapa solicitada | Estado actual (tras Etapa 1) |
|---|---|
| Tabla de productos con miniaturas | **Implementada en la Etapa 1** (listado, filtros, paginación, selección) |
| Edición individual de producto | **Implementada en la Etapa 1** (endpoint + formulario visual) |
| Duplicar producto | **Implementada en la Etapa 1** |
| Activar/desactivar producto | **Implementada en la Etapa 1** (por fila y masivo por selección; el CSV sigue funcionando) |
| Borrar producto | **Implementada en la Etapa 1** (solo sin historial; con historial sugiere desactivar) |
| Subida de imágenes | No existe | Todo (almacenamiento + validación + UI) — Etapa 2 |
| Actualización masiva de precios/stock | Parcial (publicar/ocultar por selección en Etapa 1) | Ajuste de precios y stock — Etapa 3 |
| Importación CSV | Existe y funciona | Mejorar sin romper compatibilidad — Etapa 4 |
| Importación Excel (.xlsx) | No existe | Todo (biblioteca aprobada: `exceljs`) — Etapa 4 |
| Plantilla amigable | CSV técnico con JSON | Plantilla con instrucciones y formato — Etapa 4 |
| Auditoría del catálogo | No existe | Todo — Etapa 5 |
| Respaldo de la base | No existe | Todo — Etapa 5 |
| Gestión de pedidos | **Existe y funciona** | No tocar |

---

## 3. Plan de trabajo por etapas

Cada etapa termina con pruebas ejecutadas y una parada para tu aprobación.

### Etapa 1 — Catálogo visual y edición individual · Estado: COMPLETADA (2026-10-23)

**Backend (implementado)**

- `server/db.js`: funciones nuevas de gestión individual reutilizando el esquema actual (`data` en JSON): `listCatalogProductsAdminPaged` (filtros, orden, paginación), `getProductForAdmin`, `getProductBySkuForAdmin`, `nextProductSortOrder`, `upsertProductRow` (transaccional), `setCatalogProductActive`, `catalogProductConflicts`, `categoryExists`, `deleteProductForAdmin` (409 si tiene ventas/reservas). Todas respetan el cálculo de stock disponible y las reservas activas.
- `server/services/product-rules.js` (nuevo): reglas de validación de variantes, especificaciones, imágenes y textos **extraídas de `db.js` sin duplicarlas**, con los mismos mensajes y comportamiento que la importación CSV (las 30 pruebas existentes siguen pasando, lo que valida la refactorización).
- `server/services/catalog-manage.js` (nuevo): validación y normalización de un producto individual (SKU, slug, categoría, precios enteros, stock ≥ reservas activas, slug automático desde el nombre).
- `server/admin-router.js`: nuevos endpoints bajo `/api/admin/products` (todos con sesión + same-origin + CSRF, como los existentes): `GET /products` (búsqueda, categoría, estado, stock, destacados, rango de precio, orden, paginación), `GET /products/:id`, `GET /categories`, `POST /products`, `PATCH /products/:id`, `POST /products/:id/duplicate`, `POST /products/:id/archive`, `DELETE /products/:id` (solo sin historial; con historial responde 409 y sugiere desactivar).
- `server/app.js`: el parser JSON de 32 kb no aplica a `/api/admin/` (el panel usa uno de 128 kb en su router para descripciones largas) y el backend sirve `/img` en modo solo lectura para que las miniaturas del panel y las fotos de productos funcionen con la CSP estricta (`img-src 'self'`).

**Panel (implementado)**

- `server/admin/index.html`, `admin.js`, `admin.css`, **`catalog.js` (nuevo)**: navegación por secciones (Pedidos · Catálogo), tabla de productos con miniatura, búsqueda en vivo, filtros (categoría, estado, stock, destacados), orden, paginación, selección múltiple con barra de acciones (publicar/ocultar seleccionados), acciones por fila (Editar · Duplicar · Ocultar/Publicar) y formulario de edición por secciones (Información básica · Precio · Stock · Descripción · Imágenes · Especificaciones · Variantes · Etiquetas y publicación). Variantes, especificaciones e imágenes se editan con filas visuales (agregar/quitar/reordenar), **sin JSON a mano**. El formulario informa cuando hay reservas activas que impiden bajar el stock.

**Pruebas (ejecutadas)**

- Nuevas: `server/test/admin-catalog.test.js` con 11 pruebas: autenticación/CSRF/origen, alta visible en la tienda pública, rechazo de SKU/slug/precio/stock/categoría inválidos, edición parcial que conserva campos y respeta la semántica de stock (vendidas + góndola), stock no puede bajar de reservas activas, filtros y paginación, duplicado inactivo, archivar/publicar (visibilidad en la tienda), borrado bloqueado con historial (409) y permitido sin historial, y 404 de productos inexistentes.
- Resultado: **41/41 pruebas pasaron** (las 30 existentes + 11 nuevas). Además, prueba manual de humo contra el servidor real: login, listado, creación, edición, duplicado, archivado y borrado respondieron correctamente, y el panel fue verificado en navegador (listado, formulario, guardado con mensaje de confirmación visible).

**Decisiones aplicadas en esta etapa (aprobadas por el usuario)**

- A) La tienda pública quedó conectada al backend **en local**: `js/config.js` → `catalog.apiBaseUrl: "http://127.0.0.1:3000"`. Cuando haya URL HTTPS real, se cambia ese valor (documentado en el propio archivo). CORS local documentado en `server/.env.example`.
- B) Imágenes en disco del backend (`server/data/uploads/`) — se implementa en la Etapa 2.
- C) `exceljs` se instalará en la Etapa 4.

**Nota para el dueño:** los cambios hechos en el panel se guardan en `server/data/orders.sqlite` y sobreviven reinicios. Si el backend no está corriendo, la tienda muestra un aviso y no lista productos (no muestra datos viejos).

### Etapa 2 — Gestión de imágenes · Estado: PENDIENTE

- Investigación ya hehta: no existe nada, se construye desde cero.
- Almacenamiento propuesto: carpeta persistente junto a la base de datos (`server/data/uploads/`, en el mismo disco persistente del hosting). Requiere tu confirmación (ver sección 8).
- `server/services/media.js` (nuevo): valida tipo real por bytes mágicos (JPG/PNG/WebP), tamaño máximo, dimensiones; genera nombres únicos (UUID); nunca acepta rutas del cliente.
- `server/admin-router.js`: `POST /api/admin/media` (subir), `DELETE /api/admin/media/:name` (borrar si ningún producto lo usa). Todo autenticado.
- `runtime-config.js` y `.env.example`: variable opcional de carpeta de subidas.
- Panel: en el formulario de producto, galería con arrastre para ordenar, imagen principal, vista previa, reemplazo y borrado con confirmación.
- Imágenes existentes (`img/products/*.svg`) se conservan tal cual; no se migran ni se rompen referencias.

**Pruebas previstas:** archivo con extensión falsa rechazado; exceso de tamaño rechazado; ruta de cliente ignorada; persistencia tras reinicio del servidor; imagen servida con cabeceras seguras.

### Etapa 3 — Operaciones masivas · Estado: PENDIENTE

- `server/services/bulk-ops.js` (nuevo): vista previa y aplicación transaccional.
- `server/admin-router.js`: `POST /api/admin/catalog/bulk/preview` y `POST /api/admin/catalog/bulk/apply`.
- Operaciones: porcentaje o importe fijo sobre precios (con redondeo configurable), activar/desactivar, marcar destacados, ajustar stock (respetando reservas activas).
- Alcance: por selección de la tabla o por categoría.
- La vista previa muestra producto a producto: valor actual, valor nuevo, y motivos de los que no se pueden modificar. Nada se aplica sin confirmación.
- Solo se tocan los campos elegidos: imágenes, descripciones, variantes y stock nunca se alteran en una operación de precios.

**Pruebas previstas:** los cálculos dan el importe esperado; una operación de precios no modifica stock ni otros campos; stock por debajo de reservas activas se rechaza; vista previa sin escrituras.

### Etapa 4 — Importación y exportación de Excel y CSV · Estado: PENDIENTE

- Se conserva el CSV actual sin cambios de compatibilidad (es la única vía hoy usada y está probada).
- Nueva importación con encabezados amigables en español, columnas opcionales y política explícita de campos vacíos: **vacío = conservar el valor actual; para borrar un valor debe usarse un texto explícito**.
- Soporte `.xlsx` (requiere decisión de biblioteca, ver sección 8).
- Plantilla descargable con hoja de instrucciones, ejemplo ficticio y formato de moneda.
- Flujo: analizar → validar → resumen (crear/actualizar/omitir) → errores por fila → informe descargable → confirmación → aplicación → resultado.
- Coincidencia por ID o SKU únicamente; nombres duplicados no se usan como identificador. SKU ambiguo = fila detenida con error claro.
- Nunca se reemplaza el catálogo completo por defecto.

**Pruebas previstas:** Excel inválido no modifica nada; SKU duplicado detectado; campos vacíos no borran datos; el formato CSV anterior sigue funcionando igual.

### Etapa 5 — Seguridad, historial y respaldo · Estado: PENDIENTE

- Tabla nueva `admin_audit_log` (creación incremental, compatible con los datos existentes): fecha, acción, entidad, identificador, detalle y resultado. Cubre: crear, editar (con campo y valores anterior/nuevo), duplicar, archivar, borrar, masivas, importaciones y subidas/borrados de imágenes.
- Respaldo automático antes de operaciones de riesgo (importación y masivas): copia verificable de la base en `server/data/backups/` con fecha y hora, usando el mecanismo de copia seguro de SQLite.
- Historial visible en el panel y, cuando el registro tenga el detalle suficiente, botón de reversión de operaciones puntuales de precio/stock. No se promete reversión completa: solo se revierte lo que el registro guardó.
- Se conserva el comportamiento actual de reservas, stock, pagos y notificaciones sin tocarlos.

**Pruebas previstas:** toda acción administrativa queda registrada; el respaldo se crea y es abrible; los pedidos históricos y sus importes no cambian; las pruebas existentes siguen pasando.

---

## 4. Archivos previstos (por etapa)

**Etapa 1**
- Modificar: `server/db.js`, `server/admin-router.js`, `server/admin/index.html`, `server/admin/admin.js`, `server/admin/admin.css`
- Crear: `server/services/catalog-manage.js`, `server/test/admin-catalog.test.js`

**Etapa 2**
- Modificar: `server/admin-router.js`, `server/runtime-config.js`, `server/.env.example`, `server/admin/index.html`, `admin.js`, `admin.css`
- Crear: `server/services/media.js`, `server/test/media.test.js`

**Etapa 3**
- Modificar: `server/admin-router.js`, `server/admin/index.html`, `admin.js`, `admin.css`
- Crear: `server/services/bulk-ops.js`, `server/test/bulk-ops.test.js`

**Etapa 4**
- Modificar: `server/services/catalog-admin.js` (mejoras compatibles), `server/admin-router.js`, panel
- Crear: `server/services/catalog-import-enhanced.js`, `server/test/catalog-import.test.js`

**Etapa 5**
- Modificar: `server/db.js` (tabla de auditoría), `server/services/*` (registro de acciones), panel
- Crear: `server/services/audit.js`, `server/services/backup.js`, `server/test/audit.test.js`

**No se tocan** (salvo necesidad justificada y aprobada): `js/pages/checkout.js`, `js/payments/*`, `server/services/checkout.js`, `server/services/mercadopago.js`, el esquema de `orders`/pagos y la tienda pública.

---

## 5. Dependencias nuevas posibles

| Dependencia | Para qué | Alternativa sin instalar |
|---|---|---|
| `multer` (o `busboy`) | Recibir archivos subidos (multipart) en Node | Parsear multipart a mano (no recomendado: riesgo de seguridad) |
| `exceljs` | Leer y generar archivos `.xlsx` | Limitar la Etapa 4 a CSV solamente |

Ninguna se instala sin tu aprobación previa. Cada una se justifica en su etapa.

---

## 6. Riesgos identificados

1. **Cambios invisibles en la tienda** — si `catalog.apiBaseUrl` sigue vacío, lo que edites en el panel no se ve en la tienda pública. Se documenta claramente; conectarlo requiere tu aprobación.
2. **Stock** — el cálculo disponible = físico − vendido − reservado es fácil de romper. Toda operación reutiliza las funciones existentes y las pruebas que ya lo cubren.
3. **Borrado de productos con historial** — rompería las claves foráneas de reservas y ventas. Por eso el borrado duro solo se permite sin historial; en los demás casos se desactiva.
4. **Imágenes** — subida es el vector de ataque más común: se valida el tipo real por bytes, se generan nombres propios, se sirven con `nosniff` y nunca se confía en la ruta del cliente.
5. **Categorías** — el arranque del servidor las sobrescribe desde `js/data/categories.js`. Si en el futuro se agregue edición de categorías, habrá que ajustar ese sincronizado (fuera del alcance actual).
6. **SQLite de un solo archivo** — las operaciones largas deben usar transacciones cortas para no bloquear el checkout. Ya es el patrón del código actual.
7. **CSP del panel** — prohíbe scripts inline; toda la interfaz nueva vive en archivos externos de `server/admin/`.
8. **Respaldos** — ocupan disco; se conservan los últimos N y se descartan los más viejos (definible).
9. **Datos reales** — las pruebas usarán bases en memoria o copias; nunca se reemplaza la base real por una vacía.

---

## 7. Plan de pruebas (obligatorio por etapa)

Pruebas automatizadas con `node:test` (mismo arnés que el actual, bases en memoria):

- No autenticado: no puede listar ni modificar productos (401/403).
- Edición individual: guardar un producto; los campos no modificados conservan su valor.
- Validaciones de precio, stock y SKU en frontend y backend.
- Filtros y búsqueda devuelven lo esperado.
- Aumentos y descuentos: importes exactos, redondeo correcto.
- Operación masiva: no altera campos fuera de su objetivo.
- Importación inválida: no modifica el catálogo (atómica).
- SKU duplicado: se detecta y se detiene.
- Campos vacíos: no borran datos.
- Imágenes: tipo falso rechazado, tamaño excedido rechazado, persistencia tras reinicio.
- Pedidos existentes intactos; importes históricos sin cambios.
- La tienda pública sigue mostrando los productos correctamente.
- El backend inicia sin errores.
- **Las 30 pruebas existentes siguen pasando** (verificado: 30/30 en esta auditoría).

Informe final de cada etapa: qué pruebas se ejecutaron, cuáles pasaron, cuáles fallaron y cuáles no pudieron ejecutarse. No se declara éxito solo porque la página cargue.

---

## 8. Decisiones que requieren tu aprobación

**Estado: las tres decisiones fueron aprobadas por el usuario (2026-10-23).**

- **A) Conectar la tienda al backend — APROBADA, aplicada en la Etapa 1 en modo local** (`http://127.0.0.1:3000` en `js/config.js`). CIMA es una demo para vender a otros comercios; no hay URL HTTPS todavía, así que se cambiará ese valor cuando exista el dominio real. El CORS para probar en local está documentado en `server/.env.example`.
- **B) Almacenamiento de imágenes — APROBADA: disco local del backend** (`server/data/uploads/`), se implementa en la Etapa 2.
- **C) Biblioteca para Excel — APROBADA: `exceljs`**, se instala en la Etapa 4.

---

## 9. Registro de ejecución

| Etapa | Estado | Fecha | Resultado de pruebas |
|-------|--------|-------|----------------------|
| 0 — Auditoría y planificación | **completada** | 2026-10-23 | 30/30 pruebas existentes pasaron; no se modificó ningún archivo del sistema |
| 1 — Catálogo y edición individual | **completada** | 2026-10-23 | 41/41 pruebas pasaron (30 existentes + 11 nuevas en `admin-catalog.test.js`); prueba manual de humo y verificación en navegador |
| 2 — Imágenes | pendiente | — | — |
| 3 — Operaciones masivas | pendiente | — | — |
| 4 — Excel y CSV | pendiente | — | — |
| 5 — Seguridad, historial y respaldo | pendiente | — | — |

**Problemas pendientes de esta fase:**
- Ninguno. Etapa 1 completada y a la espera de tu "OK" para comenzar la Etapa 2 (imágenes).
