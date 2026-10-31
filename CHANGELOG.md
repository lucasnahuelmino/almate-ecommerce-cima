# Changelog

Registro de los cambios importantes del proyecto.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

---

## [1.18.0] — 2026-10-31

### Tienda — Etapa 11: documentación y entrega de la Fase 1

#### Documentación
- README: **índice corregido** (dos enlaces internos apuntaban a títulos que cambiaron en etapas anteriores: "API del catálogo — inicio de Fase 2" y "SEO cuando haya un dominio"; ahora coinciden con las secciones reales).
- README: nueva sección **"Entrega de la Fase 1"** con tres partes pensadas para el dueño del negocio: qué incluye la tienda (tabla por pieza y estado), cómo se verificó (consola, responsive, auditoría de accesibilidad/SEO, pruebas del backend) y qué falta antes de vender de verdad (fotos, precios, textos legales, dominio, WhatsApp, publicación).
- README: nueva **Opción C de publicación en Vercel** (además de Netlify Drop y GitHub Pages), incluyendo que el sitio no se compila y que se republica solo al subir cambios al repositorio.

#### Verificado
- Anclas del README: **0 rotas** (validadas con el algoritmo de GitHub, incluido el doble guion del título con raya) y todos los archivos enlazados existen.
- Compatibilidad con apertura directa (`file://`): auditoría estática de 13 HTML y 23 JS → sin módulos ES, sin `import`, sin rutas absolutas a archivos locales, sin recursos faltantes y con `payments.apiBaseUrl` vacío (no intenta llamar a la API).
- Honestidad sobre el alcance: el navegador integrado no admite `file://` y el modo headless de Edge no fue confiable en esta máquina, así que la verificación de apertura directa es estática (no visual).

## [1.17.0] — 2026-10-31

### Tienda — Etapa 10C: QA responsive, accesibilidad y performance

#### Corregido
- **Menú móvil roto (bug preexistente desde el commit inicial):** el `backdrop-filter: blur(14px)` del header lo convertía en bloque de contenedor para sus hijos `position: fixed`, así que la hoja del menú quedaba atrapada dentro del header de 73px y colapsaba a 48px (solo su padding): el menú se abría pero no se veía casi nada. El efecto de vidrio ahora vive en un pseudo-elemento `.site-header::before` (mismo aspecto, sin afectar a los elementos fixed hijos).
- La hoja del menú es `position: fixed` al viewport, pero la barra de avisos empuja el header hacia abajo cuando no hay scroll: `js/ui/header.js` ahora ancla el tope de la hoja al borde real del header al abrir (`syncSheetTop`) y al redimensionar, para que nunca tape la fila del header (logo e ícono de cerrar).
- Áreas táctiles < 44px en mobile: botón "Ver producto" del home (40→44 con `--tap-min`), botones chicos `.btn--sm` de la tienda (36→44 en pantallas ≤768px) e input de cantidad del carrito (40→44). En desktop (>768px) mantienen su tamaño original.
- Contraste AA: `.eyebrow` del panel invertido del home (2.68:1 → 5.4:1 en claro / 4.9:1 en oscuro, con color propio porque el panel invierte los colores según el tema) y badge "Nuevo" (4.19:1 → 5.9:1) con el nuevo token `--color-success-strong` (declarado en los 3 bloques de `tokens.css`).
- `label-content-name-mismatch` (23 links `.brand` y 4 cards de categorías): se eliminó el `aria-label` que no contenía el texto visible — el nombre accesible ahora sale del contenido, que siempre coincide.

#### Verificado
- **Consola limpia: 12/12 páginas públicas** (0 errores ni warnings).
- **Responsive 12 páginas × 4 anchos (360/768/1024/1440): 0 overflow horizontal** (medido con un arnés temporal de iframes, ya eliminado). Menú hamburguesa y buscador probados en 360: abren/cierran, `aria-expanded` conmuta y el `overflow` del body se restaura (cierre por botón y por Escape).
- **Lighthouse (home): accesibilidad 100 · buenas prácticas 100 · SEO 100, sin fallos, en tema claro y en oscuro.**
- Reveal del home funcionando: las secciones en pantalla se revelan (`is-revealed`, opacidad 1) y las que quedan fuera permanecen ocultas hasta que entran.
- Trazada de performance del home: pintado 92ms y layout 57ms acumulados en 8.4s de captura; 6 tareas >50ms (460ms de bloqueo) durante la carga en servidor de desarrollo — perfil candidato a seguimiento si se quiere pulir más.
- Suite del backend: **92/92** ✓.

## [1.16.0] — 2026-10-30

### Tienda — Etapa 10B: pulido visual (reveal y tema)

#### Agregado
- Nuevo `js/ui/animations.js`: revelado progresivo al hacer scroll con `IntersectionObserver`. Los bloques con `data-reveal` entran con un fundido suave cuando aparecen en pantalla.
  - Seguro por diseño: sin JavaScript, sin IntersectionObserver, o con "reducir movimiento" (`prefers-reduced-motion`) activado en el sistema, el contenido queda visible normalmente — nunca algo oculto en pantalla.
  - Lo que ya está visible al cargar se marca como visto antes de activar el estado oculto: no hay parpadeo al abrir la página.
- `data-reveal` en 12 bloques: home (7 secciones: categorías, destacados, ofertas, promesas, sobre la marca, FAQ y cierre), tienda (2), contacto (1) y envíos y devoluciones (2), con `js/ui/animations.js` cargado en esas 4 páginas.
- Estilos del reveal en `css/components.css` (transición `opacity` + `translateY`, con fallback para movimiento reducido).

#### Verificado
- Botón de tema claro/oscuro en el header (existente en `js/ui/layout.js`): alterna `data-theme`, persiste la elección en `localStorage` (`cima-theme`) entre páginas, actualiza `aria-pressed`, `title` y el `theme-color`.
- Scroll progresivo en home: 7/7 secciones reveladas; 0 secciones ocultas visibles; consola sin errores ni warnings en home, tienda, contacto y envíos.

## [1.15.0] — 2026-10-27

### Tienda — Etapa 10A: SEO técnico

#### Agregado
- `sitemap.xml` con las páginas principales (home, tienda, contacto, envíos, términos, privacidad y arrepentimiento) y `robots.txt` con el apuntado al sitemap. Ambos usan la URL base `https://TU-DOMINIO.example` como placeholder: cuando haya dominio se reemplaza en `js/config.js` (`site.url`), `robots.txt` y `sitemap.xml` (instrucciones en el README).
- Nuevo `js/core/seo.js` (se carga en las 11 páginas públicas, después de `config.js`): inyecta **`rel="canonical"`** (conserva `?slug=` en producto.html y limpia filtros/parámetros en el resto), **`og:url`**, **`og:image`** (+ ancho/alto) y **`og:site_name`**, y el JSON-LD **`Organization`**. Si el placeholder sigue sin reemplazar (o el sitio se abre con `file://`), usa la dirección actual y no emite URLs rotas.
- `assets/og-image.png` (1200×630, paleta crema/terracota de la marca) para que los enlaces compartidos en WhatsApp/Instagram muestren tarjeta con imagen; `<meta name="twitter:card" content="summary_large_image">` en las 11 páginas públicas.
- `noindex, follow` en carrito, checkout, gracias y `estilos.html` (páginas transaccionales o internas que no deben indexarse).

#### Cambiado
- README: la sección "SEO cuando haya un dominio" pasó a "SEO: URL del sitio y metadatos" con el paso a paso del placeholder, y el checklist de publicación suma el item de reemplazar la URL base.

## [1.14.0] — 2026-10-26

### Panel de administración — Etapa 5: auditoría, respaldos e historial

#### Agregado
- Nueva tabla `admin_audit_log` (creación incremental en bases existentes) y registro de **toda acción del panel**: crear, editar (campo por campo con valores **anterior → nuevo**), duplicar, archivar, borrar, operaciones masivas, importaciones (CSV técnico y archivo), subidas/borrados de imágenes, respaldos y reversiones. Los intentos fallidos quedan registrados con resultado `error`. El registro **nunca rompe la operación principal**: si falla, se avisa por consola y la operación continúa.
- **Respaldo verificable antes de operaciones de riesgo**: `POST /catalog/import`, `/catalog/bulk/apply` y `/catalog/enhanced/apply` copian la base con la online backup API de better-sqlite3 a `BACKUP_DIR` (por defecto `server/data/backups/`) y verifican la copia con `PRAGMA integrity_check` (si falla, se borra el archivo y **la operación no corre**). Retención de los últimos 30 respaldos. Cada respaldo queda también registrado en el historial con su nombre y peso.
- Nueva sección **"Historial"** en el panel (junto a Pedidos y Catálogo): tabla con fecha, acción, detalle legible ("Precio: $ 89.900 → $ 90.600 · respaldo previo: …"), resultado y paginación, servida por `GET /api/admin/audit` (solo sesión, sin exponer el detalle crudo).
- Botón **"Deshacer"** en las entradas de precio/stock: `POST /api/admin/audit/:id/revert` (sesión + mismo origen + CSRF) revierte **exactamente lo que el registro guardó**, con validación completa antes de escribir (todo-o-nada en una transacción): precios en rango y stock nunca por debajo de reservas activas (si no, 409 sin tocar nada). La reversión queda registrada como `audit.revert` y también es reversible.
- Nuevo servicio `server/services/audit.js` (resúmenes en español rioplatense, listado paginado, reversión) y `server/services/backup.js` (creación + verificación + retención). `app.js`/`index.js`/`.env.example` soportan `BACKUP_DIR`; sin configurar, no se escribe en disco (suites herméticas).

#### Verificado
- 92/92 pruebas del backend pasaron (80 existentes + 12 nuevas en `audit.test.js`): registro con antes/después, errores como resultado `error`, respaldos verificables (CSV, archivo y retención de 30), masivas con datos de reversión (precio/stock) y sin reversión para publicar/ocultar, `GET /audit` con sesión y paginación, doble reversión, bloqueo por reservas sin escritura, pedidos e importes intactos, y 403/404 en la reversión sin CSRF o con id inválido.
- Humo HTTP por API y verificación en navegador: sección Historial con las entradas reales, clic en "Deshacer", confirmación y mensaje de éxito "Listo: se revirtió(n) 1 cambio(s) de precio/stock." con el precio restaurado (captura de pantalla no disponible por la ventana de escritorio; los estados se leyeron del DOM).

## [1.13.0] — 2026-10-23

### Panel de administración — Etapa 4: importación amigable de Excel y CSV

#### Agregado
- Nueva importación masiva "para humanos" junto al CSV técnico (que queda intacto): encabezados en español con alias ("Precio anterior", "Unidades", "Activo", "Enlace"…), columnas opcionales, celda vacía = **conservar** el valor actual y texto explícito `VACÍO` = vaciar un campo opcional (nombre, SKU y categoría no admiten vaciarse). Identificación **solo por ID o SKU**; si un mismo producto aparece en varias filas, ambas se detienen con el detalle y el resto del archivo se importa igual.
- Soporte `.xlsx` (dependencia `exceljs@4.4.0` en `server/`) y CSV con separador detectado automáticamente (`,` o `;`). El `.xlsx` se reconoce por bytes mágicos y se lee la hoja que contenga los encabezados (la plantilla y la exportación traen "Instrucciones" primero). Archivo inválido = 400 sin escrituras; límite 10 MB / 1000 filas.
- Flujo analizar → confirmar → aplicar: `POST /api/admin/catalog/enhanced/analyze` no escribe nada y devuelve un informe fila por fila ("Se creará" / "Se actualizará" con cambios legibles tipo "Precio: $ 10.000 → $ 11.000" / "Sin cambios" / "No se puede" + motivo, más columnas desconocidas avisadas); `POST /api/admin/catalog/enhanced/apply` re-analiza con los datos actuales y escribe todo en UNA transacción. Reutiliza `validateForSave` y `upsertProductRow` del panel: mismas reglas de validación, orden de la tienda conservado y semántica de stock (góndola + vendido, nunca por debajo de reservas activas).
- Plantilla descargable `GET /api/admin/catalog/template.xlsx` (hojas "Instrucciones" + "Productos" con ejemplos ficticios y formato de moneda `"$"#,##0`) y exportación editable del catálogo `GET /api/admin/catalog/friendly.xlsx` (round-trip verificado: exportar → editar un precio → importar marca solo la fila editada).
- Sección "Recomendada: plantilla de Excel o CSV en español" en el panel: descargas, carga de archivo, informe con tabla fila por fila, botón "Descargar informe (.csv)" (generado en el navegador) y "Aplicar N cambio(s)…" con confirmación. Acceso protegido por sesión; los POST exigen además mismo origen y token CSRF (cuerpo binario `application/octet-stream`, patrón de las imágenes).
- Compatibilidad: `parseCsvRows(csv, delimiter)` acepta separador opcional sin cambiar a los llamados existentes; el CSV técnico de 18 columnas sigue funcionando igual.

#### Verificado
- 80/80 pruebas del backend pasaron (65 existentes + 15 nuevas en `catalog-import-enhanced.test.js`): seguridad (sesión/CSRF/origen), vacío conserva, `VACÍO` limpia solo lo opcional, creación con categoría por nombre, imágenes obligatorias, SKU duplicado, ID inexistente, stock bajo reservas, XLSX inválido sin escrituras, archivo sin cambios sin escrituras, columnas ignoradas, separador `;`, plantilla y round-trip.
- Humo HTTP por API (incluido round-trip exportar→editar→importar: 25 "sin cambios" de 26) y verificación en navegador: carga de CSV, informe "1 a crear · Se creará", confirmación, mensaje "Listo: 1 producto(s) nuevo(s)." y el producto en el listado refrescado (captura de pantalla no disponible por la ventana de escritorio; los estados se leyeron del DOM).

## [1.12.0] — 2026-10-23

### Panel de administración — Etapa 3: operaciones masivas

#### Agregado
- Botón "Cambios masivos" en la barra del catálogo con sección de dos pasos: **1. alcance** (productos seleccionados en la lista, con contador en vivo, o categoría completa) y **2. operación** (cambiar precios, publicar u ocultar, destacar o quitar, ajustar stock) con campos dinámicos según la operación elegida.
- Vista previa obligatoria antes de aplicar: resumen legible ("Subir precios 10 % (redondeo: entero exacto) · 2 producto(s) en alcance · 2 a modificar") y tabla producto a producto con valor actual, valor nuevo y estado ("Se modificará" / "Sin cambios" / "No se puede" + motivo), incluido el aviso cuando cambia la etiqueta de oferta. Nada se aplica sin vista previa + confirmación.
- `server/services/bulk-ops.js`: cálculo 100 % server-side (el navegador solo manda alcance y operación). Precios por porcentaje o importe con sentido (subir/bajar) y redondeo (entero exacto, múltiplo de 10, múltiplo de 100); stock por suma, resta o valor final que nunca baja de reservas activas; precios entre $1 y $100.000.000 y stock hasta 10.000.000 de unidades, con bloqueo y motivo visibles. Máximo 1000 productos por operación.
- Endpoints autenticados (sesión + same-origin + CSRF): `POST /api/admin/catalog/bulk/preview` (no escribe) y `POST /api/admin/catalog/bulk/apply` (una sola transacción; recalcula con los datos actuales y no confía en lo enviado por el navegador).
- `server/db.js`: `patchProductData` con lista blanca (`price`, `comparePrice`, `featured`, `stock`): una operación de precios solo puede tocar el precio; imágenes, descripciones, variantes y el resto son intocables por diseño.
- La semántica de stock se mantiene íntegra: el cálculo es sobre góndola (físico − vendido) y al aplicar se guarda `data.stock = valorGóndola + vendido`.

#### Cambiado
- Los endpoints de operaciones masivas responden objeto plano, consistente con el resto de la API admin (detectado como error de renderizado durante la verificación en navegador y corregido antes de cerrar la etapa).

#### Verificado
- 65/65 pruebas del backend pasaron (55 existentes + 10 nuevas en `bulk-ops.test.js`): autenticación/CSRF/origen, cálculos y redondeos exactos, "la operación de precios no toca ni stock ni otros campos", bloqueo por reservas activas, semántica de góndola + vendido, alcance por categoría sin escrituras y entradas inválidas con mensaje claro.
- Prueba manual de humo contra el servidor real (preview sin escritura, apply, stock mixto, bloqueo con motivo, ocultar, 400 inválido, limpieza) y verificación completa en navegador: selección, panel, precio +10 %, vista previa, confirmación con diálogo, listado refrescado en $ 11.000 / $ 5.500 y bloqueo visible con motivo.

## [1.11.0] — 2026-10-23

### Panel de administración — Etapa 2: gestión de imágenes

#### Agregado
- Subida de imágenes desde el formulario de producto ("Subir imágenes", acepta JPG/PNG/WebP, máx. 10 MB): vista previa instantánea y alta en la galería del producto.
- `server/services/media.js`: validación del tipo real por bytes mágicos (nunca por la extensión ni el nombre del archivo), límites de tamaño y dimensiones (12000 px por lado, 50 MP) y nombres UUID generados por el servidor; el cliente no puede decidir rutas ni nombres.
- Endpoints autenticados (sesión + same-origin + CSRF): `POST /api/admin/media` (subir, cuerpo binario) y `DELETE /api/admin/media/:name` (borrar solo si ningún producto lo usa; responde 409 con mensaje claro si está en uso).
- El backend sirve `/media/<nombre>` en solo lectura con cabeceras seguras (`X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cache-Control: immutable`) y sin listado de carpetas.
- Galería con grip de arrastre para reordenar imágenes (con los botones ↑↓ como alternativa accesible) y borrado con confirmación para imágenes subidas.
- Variable opcional `UPLOAD_DIR` (por defecto `server/data/uploads/`, junto a la base de datos); las imágenes subidas quedan fuera de git.

#### Cambiado
- La sección Imágenes del formulario ahora distingue "Subir imágenes" (archivos nuevos) de "Agregar ruta manual" (rutas existentes como `img/products/*.svg`, que no se migran ni se rompen).

#### Verificado
- 55/55 pruebas del backend pasaron (41 existentes + 14 nuevas en `media.test.js`), incluida toda la suite previa de catálogo y CSV.
- Prueba manual de humo contra el servidor real y verificación completa en navegador: subida desde el panel, vista previa, guardado del producto y miniatura visible en el listado.

## [1.10.0] — 2026-10-23

### Panel de administración — Etapa 1: catálogo visual y edición individual

#### Agregado
- Navegación por secciones en `/admin` (Pedidos · Catálogo) y tabla de productos con miniatura, búsqueda en vivo, filtros (categoría, estado, stock, destacados), orden, paginación y selección múltiple con acciones masivas (publicar/ocultar seleccionados).
- Formulario visual de producto por secciones (Información básica · Precio · Stock · Descripción · Imágenes · Especificaciones · Variantes · Etiquetas y publicación) sin JSON a mano: filas para agregar, quitar y reordenar imágenes (con vista previa), especificaciones y variantes.
- Acciones por fila: Editar, Duplicar (copia inactiva con SKU/Slug nuevos), Ocultar/Publicar y Eliminar (solo sin historial; con ventas o reservas responde 409 y sugiere desactivar).
- Endpoints autenticados (sesión + same-origin + CSRF): `GET/POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/:id`, `POST /api/admin/products/:id/duplicate`, `POST /api/admin/products/:id/archive`, `GET /api/admin/categories`.
- Reglas de validación compartidas entre la importación CSV y el panel (`server/services/product-rules.js`) y servicio de edición individual (`server/services/catalog-manage.js`), con semántica de stock respetada (góndola vs. vendido; nunca por debajo de reservas activas).
- El backend sirve `/img` en solo lectura para que las miniaturas y fotos de productos carguen con la CSP estricta del panel (`img-src 'self'`).

#### Cambiado
- La tienda pública quedó conectada al backend en local: `js/config.js` → `catalog.apiBaseUrl: "http://127.0.0.1:3000"` (cambiar al publicar; documentado en el archivo y en `server/.env.example` con el CORS local).
- El panel administrativo usa su propio parser JSON de 128 kb (el global de 32 kb no aplica a `/api/admin/`) para descripciones largas.

#### Verificado
- 41/41 pruebas del backend pasaron (30 existentes + 11 nuevas en `admin-catalog.test.js`), incluida la importación CSV que conserva compatibilidad.
- Prueba manual de humo contra el servidor real (login, listado, creación, edición, duplicado, archivado, borrado, validaciones) y verificación en navegador del listado y el formulario.

## [1.9.0] — 2026-10-22

### Administración de catálogo, inventario y pedidos por WhatsApp

#### Agregado
- Exportación e importación autenticada de catálogo CSV desde `/admin`, con previsualización, validación completa y aplicación transaccional.
- Catálogo SQLite persistente: los datos iniciales ya no sobrescriben precios, productos ni stock administrados cuando el servidor reinicia.
- Carga opcional del catálogo remoto en inicio, tienda, ficha, carrito y checkout; ante una caída de API configurada no se muestran datos de precio/stock obsoletos.
- Registro server-side de solicitudes WhatsApp al conectar el backend, reserva de stock configurable (30 minutos por defecto) y acción para cancelar y liberar la reserva con auditoría.
- Registro interno de eventos de correo previstos. El envío sigue desactivado hasta elegir proveedor, remitente y configuración.

#### Documentación y verificación
- README actualizado con formato CSV, significado del stock, conexión de API y límites actuales del email.
- Suite backend ampliada con importación/validación CSV, estabilidad de stock, reservas y liberación administrativa.

## [1.7.0] — 2026-10-22

### Etapa 14 — Endurecimiento y preparación de despliegue

#### Agregado
- Validación de firmas de Webhooks Mercado Pago con el validador oficial del SDK e ID obtenido del parámetro firmado.
- El checkout queda deshabilitado hasta configurar el secreto; firmas faltantes, inválidas, alteradas o vencidas se rechazan.
- Validación de configuración de despliegue: HTTPS, CORS, SQLite en disco persistente y credenciales exclusivamente TEST.
- Guía de preparación de hosting persistente, variables privadas, Webhooks sandbox y verificaciones end-to-end.
- Siete pruebas nuevas de firma y configuración de despliegue; la suite del backend ahora contiene 19 pruebas.

#### Pendiente
- Ejecución del flujo sandbox en un entorno público con credenciales/usuario de prueba y dominio del titular.
- Lanzamiento productivo de pagos: requiere una etapa separada, revisión operativa y autorización expresa; esta integración continúa bloqueada a credenciales TEST.

## [1.8.0] — 2026-10-22

### Etapa 15 — Panel privado de pedidos

#### Agregado
- Panel servido por el backend con contraseña privada opcional, sesiones aleatorias `HttpOnly`/`SameSite=Strict` (y `Secure` en producción), expiración y límite de intentos por IP.
- Protección de las mutaciones con validación de origen y token CSRF; páginas y respuestas privadas usan `no-store` y CSP restrictiva.
- Listado paginado de pedidos con información de contacto y entrega necesaria para operarlos, sin exponer DNI en la respuesta administrativa.
- Estados operativos separados del estado de pago, transiciones limitadas a pedidos pagados y auditoría de cada cambio.
- Rutas y archivos del panel deshabilitados (`404`) si no se configura `ADMIN_PASSWORD`.
- Pruebas automatizadas de acceso, sesión, rate limit, CSRF, datos minimizados, transiciones y auditoría.

#### Límites
- Solo administra pedidos guardados en el backend; no incorpora pedidos coordinados exclusivamente por WhatsApp.
- No cancela pedidos ni ejecuta cambios de pago o reembolsos.

## [1.6.0] — 2026-10-22

### Etapa 13 — Mercado Pago Checkout Pro (TEST)

#### Agregado
- `POST /api/checkout` con validación de datos, variantes, zonas y stock del servidor; recalcula precios, envío y total desde el catálogo.
- Creación de preferencias Checkout Pro con el SDK oficial, acceso exclusivamente a tokens `TEST-`, expiración y retorno a `gracias.html`.
- Reservas temporales de inventario y persistencia de pedidos/estados de pago en SQLite.
- Webhook de pagos que consulta el pago a Mercado Pago, verifica pedido, moneda y total, y aplica el descuento de stock idempotentemente.
- `GET /api/orders/:id` publica el estado y resumen sin exponer datos personales.
- Proveedor `mercadopago.js`, selección de proveedor en checkout y consulta de estado en la página de gracias.
- Doce pruebas automatizadas con gateway simulado, sin transacciones reales.

#### Cambiado
- Política de privacidad y README actualizados para documentar el tratamiento de datos del checkout en backend.
- El checkout predeterminado sigue en WhatsApp; Mercado Pago solo se activa tras configurar URLs, servidor y credenciales TEST.

#### Pendiente
- Prueba end-to-end en el sandbox: requiere credencial TEST del titular, frontend HTTPS de prueba y URL HTTPS pública para el webhook.
- Retención de datos y revisión legal/operativa antes de cualquier producción.

## [1.5.0] — 2026-10-22

### Etapa 12 — Backend base

#### Agregado
- API Express con `GET /api/health`, `GET /api/products` y `GET /api/products/:slug`.
- Base SQLite que sincroniza el catálogo actual al iniciar el servidor y sirve solo productos activos.
- Configuración de puerto, base local y CORS desde variables de entorno, con ejemplo sin credenciales.
- Seis pruebas automatizadas para salud, catálogo, productos inactivos, consultas y orígenes CORS.

#### Cambiado
- README con instrucciones para instalar, iniciar y probar la API, y aclaración de que esta etapa todavía no procesa pedidos ni pagos.

## [1.4.0] — 2026-10-22

### Etapa 11 — README y entrega de Fase 1

#### Agregado
- Guía para abrir y probar la tienda, editar productos, categorías y configuración, cambiar imágenes, y desplegarla como sitio estático.
- Límites de pagos, pedidos, datos del comprador y requisitos antes de publicar.

#### Cambiado
- `LISTA-IMAGENES.md` ahora aclara que las fotos deben enlazarse manualmente desde `products.js`; los nombres sugeridos no reemplazan los SVG por sí solos.
- La documentación SEO deja explícito que el sitemap y las URLs canónicas esperan a que se defina el dominio.

## [1.3.0] — 2026-10-22

### Etapa 10 — Pulido y QA

#### Agregado
- Control accesible de modo claro/oscuro, con preferencia del sistema como valor inicial y selección guardada para visitas siguientes.
- Carga prioritaria y decodificación asíncrona para las imágenes principales de la home, el catálogo y la ficha de producto.
- En `README.md`, nota para generar el sitemap una vez definido el dominio público.

#### Verificado
- Navegación sin errores y responsive sin desbordamiento en páginas principales e informativas, en móvil y escritorio.
- Compatibilidad del control de tema con `file://`, navegación entre páginas y persistencia de preferencias.

#### Pendiente
- `sitemap.xml` y URL canónica: requieren que se defina el dominio y hosting públicos.

## [1.2.0] — 2026-10-22

### Etapa 9 — Páginas de soporte y legales

#### Agregado
- `contacto.html` con canales de contacto y horarios tomados de la configuración.
- `envios-y-devoluciones.html` con opciones y costos estimados derivados de `STORE_CONFIG.shipping`.
- `terminos.html` y `privacidad.html` como plantillas informativas que aclaran sus límites y requieren revisión profesional.
- `arrepentimiento.html` con un formulario que prepara una solicitud por WhatsApp y un enlace alternativo si se bloquean ventanas emergentes.
- `404.html` con navegación para regresar al inicio o al catálogo.
- `js/pages/support.js` para presentar los datos de contacto y entrega configurados y preparar la solicitud sin guardar datos personales.

#### Cambiado
- El checkout ahora enlaza a los términos y a la política de privacidad.

## [1.1.0] — 2026-10-22

### Etapa 8 — Checkout (Fase 1)

#### Agregado
- `checkout.html` y `js/pages/checkout.js` con datos del comprador, validaciones de email/teléfono/DNI/código postal, selección de entrega y forma de pago, y resumen de importes.
- `js/payments/provider.js` y `js/payments/whatsapp.js` para crear pedidos mediante una interfaz de proveedor, con transferencia y descuento configurable sin publicar datos bancarios.
- `js/core/orders.js`, `gracias.html` y `js/pages/thanks.js` para conservar y consultar el comprobante pendiente, sin guardar datos personales del cliente en el navegador.
- Envío de productos, variantes, datos de contacto, entrega, pago y total estimado en la consulta de WhatsApp.

#### Cambiado
- Carrito y mini-carrito conducen al checkout; el comprobante aclara que el pedido queda pendiente de coordinación y no representa un pago confirmado.

## [1.0.0] — 2026-10-22

### Etapa 7 — Carrito

#### Agregado
- `js/core/cart.js` con carrito persistente en `localStorage`, variantes como líneas independientes, validación de cantidades/stock, sincronización entre pestañas y aviso de cambios de precio o disponibilidad.
- `carrito.html` y `js/pages/cart.js` para revisar, actualizar y quitar productos, ver el subtotal y el progreso al envío gratis, y consultar el pedido por WhatsApp.
- Acciones para agregar productos desde la ficha y editar cantidades o quitar productos desde el mini-carrito.

#### Cambiado
- El drawer comparte el subtotal y el progreso al envío gratis; el contador del header se actualiza al instante.
- Se retiró el enlace al checkout todavía inexistente; el checkout completo se incorpora en la Etapa 8.

## [0.9.0] — 2026-10-22

### Etapa 6 — Detalle de producto

#### Agregado
- `producto.html` con ficha responsive, galería, selector de variantes y cantidad, stock, envío estimado, descripción, especificaciones, productos relacionados y datos estructurados Product/BreadcrumbList.
- `js/pages/product.js` para cargar la ficha por `?slug=`, actualizar metadatos, controlar la galería y calcular el envío según la configuración.
- Tratamiento de descripciones con etiquetas permitidas para evitar insertar HTML arbitrario en la ficha.
- Estado claro para enlaces de producto inexistentes o no disponibles.
- Regla global para que los componentes con el atributo `hidden` permanezcan ocultos aunque sus estilos declaren `display`.

#### Cambiado
- Las tarjetas del catálogo y de la home ahora llevan al detalle del producto.
- La consulta por WhatsApp desde la ficha incluye SKU, cantidad y variantes seleccionadas.

---

## [0.8.0] — 2026-10-22

### Etapa 5 — Catálogo

#### Agregado
- `tienda.html` con búsqueda, sugerencias, categorías, filtros por precio/disponibilidad/etiquetas, orden, estado vacío y paginación.
- `js/core/catalog.js` para búsqueda, filtros, ofertas y orden reutilizables sin manipular el DOM.
- `js/pages/shop.js` para representar el catálogo y reflejar los filtros en la URL.
- Estilos responsive del catálogo en `css/pages.css`.

#### Cambiado
- Las tarjetas de categorías de la home enlazan al catálogo con su categoría seleccionada.
- La navegación distingue el listado general de la vista de ofertas para marcar una sola sección activa.

#### Pendiente
- La página de detalle de producto se incorpora en la Etapa 6; mientras tanto, cada tarjeta permite consultar el artículo por WhatsApp.
- El agregado al carrito se incorpora en la Etapa 7.

---

## [0.7.0] — 2026-10-22

### Etapa 4 — Home

#### Agregado
- Portada con hero, categorías, productos destacados y ofertas tomadas del catálogo, beneficios de compra, presentación de CIMA, preguntas frecuentes y enlaces de consulta por WhatsApp/Instagram.
- `js/pages/home.js` para presentar categorías y productos activos desde los datos existentes y completar precios/beneficios configurables sin dependencias externas.
- `css/pages.css` con estilos responsive para la página de inicio.

#### Cambiado
- `index.html` carga los datos del catálogo y el contenido específico de la home.

#### Pendiente
- No se agregaron testimonios inventados ni un formulario de newsletter sin servicio de suscripción.

---

## [0.6.0] — 2026-10-22

### Etapa 3 — Layout global

#### Agregado
- `index.html` como primera página navegable, con header adaptable, buscador, navegación, barra de beneficios, footer legal/de contacto y drawer del mini-carrito.
- Conexión de los datos de marca y contacto desde `STORE_CONFIG`; los campos vacíos se ocultan y el logo ahora toma su ruta desde config.
- Comportamiento de apertura/cierre del menú y carrito, manejo de foco accesible, búsqueda que prepara la URL del catálogo y contador preparado para la etapa del carrito.
- Portada provisoria hasta construir la home en la Etapa 4.

#### Cambiado
- `css/layout.css`: estilos responsive de la estructura global y de la portada provisoria; el resumen del carrito respeta el estado oculto.
- `js/ui/header.js` y `js/ui/mini-cart.js`: estado accesible, cierre con Escape y foco contenido/restaurado en los paneles.
- `js/ui/layout.js`: soporte para cargar imágenes desde rutas configuradas con `data-store-src`, texto en el enlace de email y ocultamiento de opciones desactivadas.

---

## [0.5.0] — 2026-10-21

### Datos de contacto y legales reales

#### Cambiado en `js/config.js`
- WhatsApp → `5491134761743`
- Email → `cima.home@gmail.com`
- Instagram → `cima.hogar`
- Razón social → `Lucas Nahuel Miño`
- CUIT → `20-36296907-8` (verificado: dígito corrector válido)

#### Pendiente
- Dirección del local, horario de atención y domicilio fiscal (campos `address`/`schedule` vacíos, marcados ⚠️).

---

## [0.4.0] — 2026-10-21

### Nombre de la tienda confirmado

#### Cambiado
- `NOMBRE_TIENDA` → **`CIMA`** en todo el proyecto: `js/config.js` (marca y títulos SEO), `assets/logo.svg`, `assets/favicon.svg` (letra "C"), título de `estilos.html` y registro de decisiones en `AGENTS.md`.
- Contacto actualizado a `hola@cima.com.ar` / Instagram `cima` (⚠️ pendiente de confirmar con el dueño).

#### Pendiente
- Datos de contacto reales (WhatsApp, email, Instagram), razón social y CUIT (marcados con ⚠️ en `config.js`).

---

## [0.3.0] — 2026-10-21

### Etapa 2 — Datos y config

#### Agregado
- `js/config.js` (`window.STORE_CONFIG`): marca, contacto (WhatsApp/email/Instagram), moneda es-AR, paleta de referencia, envíos (envío gratis desde $80.000 + zonas CABA/GBA e Interior), pagos (provider `whatsapp`, descuento transferencia 10%), 2 cupones preparados, SEO por defecto, datos legales y créditos. Sin credenciales reales (solo placeholders).
- `js/data/categories.js` (`window.CATEGORIES`): 8 categorías reales + "Ofertas" como categoría virtual (`isVirtual`), cada una con imagen, ícono SVG inline y descripción.
- `js/data/products.js` (`window.PRODUCTS`): **24 productos** realistas de bazar argentino, repartidos en las 8 categorías. Precios en ARS enteros de $9.900 a $129.900, 9 con precio tachado, 6 destacados, 1 agotado y 3 con stock bajo (para probar todos los estados). Incluye SKU, descripción HTML, especificaciones, variantes de color, etiquetas y `createdAt`.

#### Verificado en navegador
- Cero problemas de validación: sin ids/slugs/SKUs duplicados, todos los precios son enteros, `comparePrice > price`, todas las categorías existen.
- Las 32 imágenes (24 productos + 8 categorías) responden 200.
- `STORE_CONFIG` completo y con la estructura que espera la Fase 2.

#### Notas
- Las imágenes de productos apuntan al placeholder SVG hasta cargar fotos reales (cuando se carguen, se actualiza el array `images`).
- El bloque `theme.colors` de config es referencia; lo operativo de colores sigue en `css/tokens.css` (que además maneja el modo oscuro).

---

## [0.2.0] — 2026-10-21

### Etapa 1 — Design system

#### Agregado
- `css/tokens.css`: variables globales del diseño (colores, tipografía fluida con `clamp()`, espacios, radios, sombras, transiciones y capas z-index). Incluye modo oscuro automático (`prefers-color-scheme`) y manual (`data-theme` en `<html>`).
- `css/base.css`: reset moderno, tipografía base, enlaces, foco visible (accesibilidad), bloque `prefers-reduced-motion` y utilidades (`.container`, `.sr-only`, `.skip-link`).
- `css/components.css`: botones (primary/secondary/outline/ghost + tamaños), badges, cards de producto, precios, campos de formulario (con estado de error), checkbox/radio, selector de cantidad, chips, barra de progreso, esqueletos de carga, toasts, modal y base del drawer lateral.
- `estilos.html`: página interna de prueba con todos los componentes, toggle de modo oscuro, toast y modal funcionales. No aparece en buscadores (`noindex`).

#### Notas de accesibilidad
- Contraste AA verificado: el terracota de marca `#C8553D` se usa para íconos y títulos grandes; los fondos de botón y textos chicos usan la variante `#B0442D` (5.7:1 con blanco).
- Áreas táctiles mínimas de 44px, foco visible always y etiquetas `aria-*` en los componentes interactivos.

---

## [0.1.0] — 2026-10-21

### Etapa 0 — Plan y setup

#### Agregado
- `AGENTS.md` con la directiva maestra del proyecto (contexto permanente del trabajo).
- Estructura de carpetas inicial: `css/`, `js/` (con `data/`, `core/`, `payments/`, `ui/`, `pages/`), `img/` (con `products/`, `categories/`, `brand/`), `assets/` y `server/` (preparada para la Fase 2).
- `.gitignore`: le indica a git qué no subir (credenciales, `node_modules`, archivos del sistema).
- 24 placeholders de productos en `img/products/` y 8 de categorías en `img/categories/` (SVG con tono e ícono por categoría).
- `assets/logo.svg` y `assets/favicon.svg` provisorios.
- `LISTA-IMAGENES.md`: planilla con los nombres exactos de archivo a subir para reemplazar los placeholders.

#### Decisiones confirmadas
- El sitio vive en la raíz de la carpeta del proyecto (sin subcarpeta intermedia).
- Tipografías: Fraunces (titulares) + Inter (cuerpo) vía Google Fonts, con fallback a fuentes del sistema.
- Imágenes: placeholders SVG neutros hasta cargar las fotos reales.

#### Pendiente
- Nombre definitivo de la tienda (hoy figura como `NOMBRE_TIENDA` en los placeholders; se configurableá en la Etapa 2).
