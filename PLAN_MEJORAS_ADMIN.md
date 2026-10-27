# PLAN DE MEJORAS DEL PANEL DE ADMINISTRACIÓN — CIMA

> Documento central de planificación y seguimiento.
> Estado de las etapas: **pendiente** · **en curso** · **bloqueada** · **completada**
> Última actualización: 2026-10-23 (Etapa 3 completada: operaciones masivas)

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
| Actualización masiva de precios/stock | **Implementada en la Etapa 3** (precios, publicación, destacados y stock, con vista previa) |
| Importación CSV | Existe y funciona | **Se conserva intacta en la Etapa 4**; nueva importación amigable en paralelo |
| Importación Excel (.xlsx) | No existe | **Implementada en la Etapa 4** (`exceljs`, analizar → confirmar → aplicar) |
| Plantilla amigable | CSV técnico con JSON | **Implementada en la Etapa 4** (plantilla `.xlsx` con instrucciones, ejemplos y formato de moneda) |
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

### Etapa 2 — Gestión de imágenes · Estado: COMPLETADA (2026-10-23)

**Backend (implementado)**

- `server/services/media.js` (nuevo): valida tipo real por bytes mágicos (JPG, PNG o WebP — nunca confía en la extensión ni en el nombre del archivo), tamaño máximo (10 MB), dimensiones (máx. 12000 px por lado, 50 MP); genera nombres UUID únicos; nunca acepta rutas del directorio del cliente. El servicio se puede instanciar con cualquier carpeta (para pruebas usa un directorio temporal).
- `server/admin-router.js`: `POST /api/admin/media` (subir, cuerpo binario `application/octet-stream`, 12 mb), `DELETE /api/admin/media/:name` (borrar solo si ningún producto lo usa; responde 409 con mensaje claro si está en uso). Todo con sesión + same-origin + CSRF, como los endpoints existentes.
- `server/app.js`: el backend sirve `/media/<nombre>` en modo solo lectura con cabeceras seguras (`X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cache-Control: immutable`), sin listado de carpetas y solo para extensiones de imagen.
- `server/index.js`: la carpeta de subidas se resuelve desde `UPLOAD_DIR` (opcional) o por defecto `server/data/uploads/` (junto a la base de datos, en el mismo disco persistente).
- `server/.env.example` y `.gitignore`: variable `UPLOAD_DIR` documentada; las imágenes subidas quedan fuera de git.
- `server/db.js`: nueva función `catalogImageUsage(database, imagePath)` para contar cuántos productos usan una imagen (para proteger el borrado).

**Panel (implementado)**

- `server/admin/index.html`, `catalog.js`, `admin.css`: en la sección Imágenes del formulario de producto, botón "Subir imágenes" (input de archivo persistente acepta JPG/PNG/WebP), vista previa instantánea, grip de arrastre para reordenar (con botones ↑↓ como alternativa accesible), botón "Quitar" con confirmación para imágenes subidas (`/media/…`), y "Agregar ruta manual" para rutas existentes (`img/products/*.svg`). Las imágenes existentes no se migran ni se rompen.

**Pruebas (ejecutadas)**

- Nuevas: `server/test/media.test.js` con 14 pruebas: autenticación/CSRF/origen, subida de PNG/JPEG/WebP con nombre UUID, rechazo de archivos falsos (bytes mágicos), rechazo de tamaño excesivo, rechazo de path traversal, servido con cabeceras seguras, sin listado de carpetas, borrado de imagen libre (204) y en uso (409), conteo de uso, nombres únicos sin sobrescritura, validación de buffer, y persistencia tras reinicio del servicio.
- Resultado: **55/55 pruebas pasaron** (las 41 existentes + 14 nuevas). Además, prueba manual de humo contra el servidor real y verificación completa en navegador: subida desde el panel, vista previa, guardado de producto con la imagen, y miniatura visible en el listado.

**Pruebas previstas:** archivo con extensión falsa rechazado; exceso de tamaño rechazado; ruta de cliente ignorada; persistencia tras reinicio del servidor; imagen servida con cabeceras seguras.

### Etapa 3 — Operaciones masivas · Estado: COMPLETADA (2026-10-23)

**Backend (implementado)**

- `server/services/bulk-ops.js` (nuevo): `previewBulkOperation` y `applyBulkOperation`. El navegador solo manda alcance (ids de la selección o categoría) y operación; el servidor valida todo, resuelve el alcance con las funciones existentes (`getProductForAdmin`, `listCatalogProductsAdminPaged`) y calcula fila por fila con estado `change` / `noop` / `blocked` más el motivo visible. La vista previa no escribe nada; la aplicación corre en UNA transacción y recalcula con los datos actuales (no confía en lo que envió el navegador). Máximo 1000 productos por operación; si una categoría lo supera, avisa y sugiere usar la selección.
- Operaciones: precios por porcentaje o importe con sentido (subir/bajar) y redondeo configurable (entero exacto, múltiplo de 10 o múltiplo de 100); publicar/ocultar; destacar/quitar de destacados; stock (sumar, restar o poner un valor final). Semántica de stock respetada: se calcula sobre góndola (físico − vendido), se guarda `data.stock = valorGóndola + vendido` y nunca baja de reservas activas (fila bloqueada con el motivo). Precios fuera de rango ($1 a $100.000.000) y stock fuera de rango también se bloquean con motivo; un cambio que altera la etiqueta de oferta (precio tachado) se avisa como nota.
- `server/db.js`: nueva función `patchProductData` con lista blanca (`PATCHABLE_PRODUCT_FIELDS`: `price`, `comparePrice`, `featured`, `stock`) que solo puede tocar esos campos del JSON. Imágenes, descripciones, variantes y el resto son intocables por diseño (un intento fuera de la lista lanza error).
- `server/admin-router.js`: `POST /api/admin/catalog/bulk/preview` y `POST /api/admin/catalog/bulk/apply`, con sesión + same-origin + CSRF como el resto de mutaciones. Responden objeto plano, consistente con el resto de la API admin.

**Panel (implementado)**

- `server/admin/index.html`, `catalog.js`, `admin.css`: botón "Cambios masivos" en la barra del catálogo (con `aria-expanded`/`aria-controls`) y sección con dos pasos: **1. alcance** (selección de la lista con contador en vivo, o categoría completa) y **2. operación** (campos dinámicos según la elegida: sentido/tipo/valor/redondeo en precios; Sí/No en publicación y destacados; tipo de ajuste/unidades en stock). Botón "Ver vista previa" que muestra resumen legible ("Subir precios 10 % (redondeo: entero exacto) · 2 producto(s) en alcance · 2 a modificar") y tabla producto a producto (Producto · Valor actual · Valor nuevo · Estado) con estados "Se modificará", "Sin cambios" y "No se puede" + motivo, y nota cuando cambia la etiqueta de oferta. El botón "Aplicar N cambio(s)…" solo aparece con una vista previa fresca (tocar cualquier control la invalida), pide confirmación con `window.confirm` y tras aplicar muestra "Listo: N producto(s) modificado(s)." y refresca el listado. Nada se aplica sin vista previa + confirmación.

**Pruebas (ejecutadas)**

- Nuevas: `server/test/bulk-ops.test.js` con 10 pruebas: autenticación/CSRF/origen (preview y apply), cálculo de porcentaje esperado sin escrituras, los tres modos de redondeo con importes exactos, la operación de precios no toca stock ni ningún otro campo (comparación campo por campo antes/después), mezcla de cambio y bloqueado aplicando solo el válido, stock bloqueado por reservas activas con el motivo, semántica de stock (guardado = góndola + vendido y `availableStock` correcto), operaciones de publicación/destacados sin tocar precios, alcance por categoría sin escrituras, y entradas inválidas rechazadas con mensajes claros (400).
- Resultado: **65/65 pruebas pasaron** (las 55 existentes + 10 nuevas). Además, prueba manual de humo contra el servidor real (vista previa sin escritura, apply de precios con stock intacto, ajuste de stock mixto, bloqueo con motivo, ocultar, entrada inválida 400 y borrado de limpieza) y verificación completa en navegador: selección de 2 productos, apertura del panel con contador "(2)", precio +10 %, vista previa con resumen y filas `$ 10.000 → $ 11.000`, confirmación con diálogo, mensaje "Listo: 2 producto(s) modificado(s)" con el listado refrescado en $ 11.000 / $ 5.500, y bloqueo visible con motivo al restar 100 unidades de stock.
- **Detalle corregido durante la verificación:** los endpoints respondían `{ result: … }` en vez del objeto plano que usa el resto de la API admin; el navegador mostró un error de JS al renderizar la vista previa. Se corrigió el shape de respuesta, se actualizaron tests y humo, y se repitió la verificación completa con resultado correcto.

### Etapa 4 — Importación y exportación de Excel y CSV · Estado: COMPLETADA (2026-10-23)

- Se conserva el CSV actual sin cambios de compatibilidad (es la única vía hoy usada y está probada).
- Nueva importación con encabezados amigables en español, columnas opcionales y política explícita de campos vacíos: **vacío = conservar el valor actual; para borrar un valor debe usarse un texto explícito**.
- Soporte `.xlsx` (requiere decisión de biblioteca, ver sección 8).
- Plantilla descargable con hoja de instrucciones, ejemplo ficticio y formato de moneda.
- Flujo: analizar → validar → resumen (crear/actualizar/omitir) → errores por fila → informe descargable → confirmación → aplicación → resultado.
- Coincidencia por ID o SKU únicamente; nombres duplicados no se usan como identificador. SKU ambiguo = fila detenida con error claro.
- Nunca se reemplaza el catálogo completo por defecto.

**Pruebas previstas:** Excel inválido no modifica nada; SKU duplicado detectado; campos vacíos no borran datos; el formato CSV anterior sigue funcionando igual.

**Implementado y verificado (2026-10-23)**

- `server/services/catalog-import-enhanced.js`: encabezados en español con alias ("Precio anterior", "Unidades", "Activo", "Enlace"…); celda vacía = conservar y "VACÍO" = vaciar un campo opcional (nombre, SKU y categoría no se pueden vaciar, con mensaje de fila); identificación solo por ID o SKU; si un mismo producto aparece en varias filas, **ambas** se detienen (dato ambiguo) y el resto del archivo se importa igual; categoría acepta ID o nombre ("Cocina"); especificaciones/variantes en texto ("Material: aluminio" / "Color: Negro|Rojo"); números en formato argentino ("89.900") y booleanos Sí/No.
- Archivos: CSV con separador detectado automáticamente (`,` o `;`) y `.xlsx` por bytes mágicos, leyendo la hoja que contenga los encabezados (así funciona el archivo exportado, que trae "Instrucciones" primero). XLSX basura = 400 sin escrituras; límite 10 MB / 1000 filas.
- Flujo completo: `analyze` sin escrituras → informe (crear/actualizar/sin cambios/error por fila, con cambios legibles "Precio: $ 10.000 → $ 11.000", columnas desconocidas avisadas) → confirmación → `apply` que re-analiza y escribe todo en UNA transacción. Reutiliza `validateForSave` (mismas reglas del panel) y `upsertProductRow` (conserva el orden de la tienda y la semántica de stock góndola + vendido); stock nunca baja de reservas activas.
- Endpoints (sesión + same-origin + CSRF en los POST; solo sesión en los GET): `GET /api/admin/catalog/template.xlsx` (hojas Instrucciones + Productos con ejemplos y formato `"$"#,##0`), `GET /api/admin/catalog/friendly.xlsx` (catálogo actual editable), `POST /api/admin/catalog/enhanced/analyze` y `POST /api/admin/catalog/enhanced/apply` (cuerpo binario `application/octet-stream`).
- Panel: sección "Recomendada: plantilla de Excel o CSV en español" con los dos vínculos de descarga, carga de archivo, informe fila por fila (Se creará / Se actualizará / Sin cambios / No se puede + motivo), botón "Descargar informe (.csv)" generado en el navegador y "Aplicar N cambio(s)…" con `window.confirm`; al aplicar refresca el listado. El CSV técnico queda debajo, sin cambios de interfaz ni de formato.
- Compatibilidad: `parseCsvRows(csv, delimiter)` con separador opcional (los llamados existentes no cambian). `exceljs@4.4.0` instalada en `server/`.
- Correcciones de diseño detectadas durante la etapa: la exportación round-trip marca como "sin cambios" lo que no cambió (se comparan listas por contenido, no por cantidad), y la hoja de datos se localiza entre las hojas del archivo.
- **Pruebas ejecutadas:** 80/80 (65 existentes + 15 nuevas en `catalog-import-enhanced.test.js`): seguridad (401/403), celdas vacías conservan datos, VACÍO limpia solo lo opcional, creación con categoría por nombre, imágenes obligatorias en creación, SKU duplicado, ID inexistente, stock bajo reservas, XLSX inválido sin escrituras, archivo sin cambios sin escrituras, columnas ignoradas, separador `;`, plantilla, round-trip exportar→editar→importar y exportación completa.
- Verificación manual: humo HTTP por API (todo OK) y en navegador real: carga del CSV, informe ("1 a crear", "Se creará"), confirmación ("¿Importar 1 producto(s) nuevo(s)…?"), mensaje "Listo: 1 producto(s) nuevo(s)." y el producto en el listado refrescado. La captura de pantalla no pudo tomarse (ventana de escritorio no visible); los estados se leyeron del DOM.

### Etapa 5 — Seguridad, historial y respaldo · Estado: COMPLETADA (2026-10-26)

- Tabla nueva `admin_audit_log` (creación incremental, compatible con los datos existentes): fecha, acción, entidad, identificador, detalle y resultado. Cubre: crear, editar (con campo y valores anterior/nuevo), duplicar, archivar, borrar, masivas, importaciones, subidas/borrados de imágenes, respaldos y reversiones.
- Respaldo automático antes de operaciones de riesgo (importación CSV, importación de archivo y masivas): copia verificable de la base en `server/data/backups/` (`BACKUP_DIR` configurable) con la online backup API de better-sqlite3 + `PRAGMA integrity_check` sobre la copia, retención de los últimos 30. Si el respaldo falla, **la operación no se ejecuta**.
- Historial visible en el panel (nueva sección "Historial") con fecha, acción, detalle legible, resultado y botón "Deshacer": la reversión es todo-o-nada, valida todo antes de escribir, aplica en una transacción y solo revierte precio/stock (lo que el registro guardó), nunca por debajo de reservas activas. La reversión queda registrada y también es reversible.
- Se conserva el comportamiento actual de reservas, stock, pagos y notificaciones sin tocarlos.

**Pruebas ejecutadas:** 92/92 (80 existentes + 12 nuevas en `audit.test.js`): creación/edición con antes-después, duplicar/archivar/borrar, error registrado como resultado `error`, respaldo CSV y de archivo verificable (`integrity_check` = ok) con su registro, retención de 30 respaldos, masiva con `revertChanges` de precio/stock, publicar no revertible, `GET /audit` con sesión y paginación sin exponer detalle crudo, revert doble (re-revert incluido), revert bloqueado por reservas (409 sin escribir), pedidos e importes intactos antes/después, y revert sin CSRF (403) o con id inválido (404).

**Verificación manual:** humo HTTP por API (login → historial → edición con antes/después → masiva con respaldo en disco de 152 KB → revert restauró el precio exacto) y en navegador real: sección Historial con las 4 entradas, clic en "Deshacer" con diálogo de confirmación, mensaje de éxito visible y precio restaurado (90.600 → 90.500 → 90.600). La captura de pantalla no pudo tomarse (ventana de escritorio no visible); los estados se leyeron del DOM.

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
- Modificar: `server/services/catalog-admin.js` (compat: `parseCsvRows` con separador opcional + exports), `server/services/catalog-manage.js` (export de `validateForSave`), `server/admin-router.js`, `server/admin/index.html`, `server/admin/catalog.js`, `server/admin/admin.css`
- Crear: `server/services/catalog-import-enhanced.js`, `server/test/catalog-import-enhanced.test.js` (el nombre previsto era `catalog-import.test.js`; se le agregó el sufijo para reflejar el servicio real)

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
| 2 — Imágenes | **completada** | 2026-10-23 | 55/55 pruebas pasaron (41 existentes + 14 nuevas en `media.test.js`); prueba manual de humo y verificación completa en navegador |
| 3 — Operaciones masivas | **completada** | 2026-10-23 | 65/65 pruebas pasaron (55 existentes + 10 nuevas en `bulk-ops.test.js`); prueba manual de humo y verificación completa en navegador (vista previa, confirmación, apply y bloqueo con motivo) |
| 4 — Excel y CSV | **completada** | 2026-10-23 | 80/80 pruebas pasaron (65 existentes + 15 nuevas en `catalog-import-enhanced.test.js`); humo HTTP y verificación en navegador (análisis, informe, confirmación, apply y listado refrescado) |
| 5 — Seguridad, historial y respaldo | **completada** | 2026-10-26 | 92/92 pruebas pasaron (80 existentes + 12 nuevas en `audit.test.js`); humo HTTP y verificación en navegador (historial, confirmación de reversión y precio restaurado) |

**Problemas pendientes de esta fase:**
- Ninguno. Las 5 etapas de mejoras del panel quedaron completadas.
