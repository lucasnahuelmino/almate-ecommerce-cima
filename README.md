# CIMA — Bazar, hogar y cocina

Tienda estática hecha con HTML, CSS y JavaScript. No requiere instalar programas ni compilar el proyecto. Se puede revisar abriendo `index.html` y publicar en un hosting estático.

## Índice

- [Abrir y probar la tienda](#abrir-y-probar-la-tienda)
- [Archivos y carpetas principales](#archivos-y-carpetas-principales)
- [Editar productos](#editar-productos)
- [Administrar catálogo con CSV](#administrar-catálogo-con-csv)
- [Cambiar fotos](#cambiar-fotos)
- [Editar categorías](#editar-categorías)
- [Cambiar datos del negocio](#cambiar-datos-del-negocio)
- [Publicar la tienda](#publicar-la-tienda)
- [Entrega de la Fase 1](#entrega-de-la-fase-1)
- [API de catálogo y pagos — backend Fase 2](#api-de-catálogo-y-pagos--backend-fase-2)
- [Límites importantes de esta versión](#límites-importantes-de-esta-versión)
- [Antes de publicar: checklist](#antes-de-publicar-checklist)
- [SEO: URL del sitio y metadatos](#seo-url-del-sitio-y-metadatos)

## Abrir y probar la tienda

1. Abrí la carpeta del proyecto en el Explorador de archivos.
2. Hacé doble clic en `index.html`. Para probar la experiencia completa, usá Chrome o Edge actualizados.
3. Recorré el catálogo, abrí un producto, agregalo al carrito y verificá el checkout. Usá datos de prueba: el envío abre WhatsApp y no cobra.
4. También se puede abrir la carpeta en Visual Studio Code. No es necesario instalar extensiones para que la tienda funcione.

El carrito y el comprobante se guardan en el navegador. Al borrar sus datos de navegación se pueden borrar también esos datos de prueba.

## Archivos y carpetas principales

| Ruta | Para qué sirve |
| --- | --- |
| `index.html`, `tienda.html`, `producto.html` | Inicio, catálogo y ficha de producto |
| `carrito.html`, `checkout.html`, `gracias.html` | Carrito y solicitud del pedido |
| `contacto.html`, `envios-y-devoluciones.html` | Información de contacto y entrega |
| `terminos.html`, `privacidad.html`, `arrepentimiento.html` | Textos informativos y legales |
| `js/config.js` | Datos del negocio, envíos, pagos y contacto |
| `js/data/products.js` | Productos, precios, stock, fotos y variantes |
| `js/data/categories.js` | Categorías y sus datos |
| `img/products/`, `img/categories/` | Imágenes de productos y categorías |
| `assets/` | Logo y favicon |
| `css/` | Colores, tipografía, componentes y diseño de páginas |

Hacé una copia de seguridad del archivo antes de editarlo. Editá una cosa por vez y guardá con el mismo nombre y extensión.

## Editar productos

Abrí `js/data/products.js`. Cada producto es un bloque entre `{ }` dentro de `window.PRODUCTS`. Para cambiar uno, modificá sus valores sin borrar comas ni comillas. Para agregar uno, copiá un bloque completo y asignale un `id`, `slug` y `sku` que no estén usados.

| Campo | Qué poner |
| --- | --- |
| `id` | Código interno único, por ejemplo `"p_0025"` |
| `slug` | URL única, en minúsculas y con guiones; sin espacios ni acentos |
| `name` | Nombre que verá el cliente |
| `category` | El `id` exacto de una categoría en `categories.js`, por ejemplo `"cocina"` |
| `subcategory` | Grupo descriptivo, en minúsculas y con guiones |
| `price` | Precio actual como número entero, sin `$`, puntos ni comas: `25900` |
| `comparePrice` | Precio anterior para mostrar una oferta; usar `null` si no hay oferta |
| `stock` | Unidades disponibles. `0` muestra el artículo como agotado |
| `sku` | Código interno único para identificar el artículo |
| `images` | Rutas relativas a la carpeta del proyecto; la primera es la foto principal |
| `shortDescription` | Descripción breve para las tarjetas |
| `description` | Descripción de la ficha; puede incluir párrafos HTML sencillos |
| `specs` | Lista de detalles, cada uno con `label` y `value` |
| `variants` | Opciones como color o tamaño; dejar `[]` si el artículo no tiene |
| `tags` | Etiquetas como `"nuevo"` u `"oferta"`; dejar `[]` si no hay |
| `featured` | `true` para destacar en el inicio, `false` para no destacarlo |
| `active` | `true` para publicarlo, `false` para ocultarlo sin borrarlo |
| `createdAt` | Fecha de alta en formato `"AAAA-MM-DD"` |

Ejemplo de la estructura mínima (reemplazá los valores y completá los campos descriptivos al copiar el bloque real):

```js
{
  id: "p_0025",
  slug: "jarra-vidrio-1-litro",
  name: "Jarra de vidrio de 1 litro",
  category: "mesa-vajilla",
  subcategory: "jarras",
  price: 18900,
  comparePrice: null,
  stock: 12,
  sku: "MVA-JAR-001",
  images: ["img/products/jarra-vidrio-1-litro.webp"],
  shortDescription: "Jarra de vidrio para servir bebidas.",
  description: "<p>Descripción del producto.</p>",
  specs: [{ label: "Capacidad", value: "1 litro" }],
  variants: [],
  tags: [],
  featured: false,
  active: true,
  createdAt: "2026-10-22"
},
```

El bloque debe llevar coma si hay otro producto después. En JavaScript, textos entre comillas, números sin comillas, `true`/`false` en minúscula y `null` sin comillas. No pegues el ejemplo como producto real sin confirmar datos, stock y precio.

**Para una oferta:** `comparePrice` debe ser mayor que `price`; la etiqueta `"oferta"` también puede incluir el producto en ofertas. Revisá que el precio anterior sea real. **Para agotarlo temporalmente:** cambiá `stock` a `0`. **Para ocultarlo:** cambiá `active` a `false`.

Las variantes mostradas en la ficha son opciones del producto; el inventario se gestiona en el campo general `stock`, no por variante.

## Administrar catálogo con CSV

Cuando el backend esté publicado y `ADMIN_PASSWORD` configurada, ingresá a `https://<api-host>/admin`. El panel permite descargar el catálogo completo y cargar un CSV con previsualización: primero valida encabezados, filas, identificadores, categorías, importes, stock e imágenes; una segunda confirmación aplica los cambios en una transacción. Un CSV inválido no aplica parcialmente filas. Los productos omitidos no se borran ni se modifican; para ocultar uno, poné `active=false`.

El CSV exportado es la plantilla oficial y contiene estas columnas en este orden: `id, sku, slug, name, category, subcategory, price, stock, active, comparePrice, images, shortDescription, description, specs, variants, tags, featured, createdAt`. Mantené todas las columnas. `images` y `tags` se separan con `|`; `specs` y `variants` se escriben como JSON válido en la celda. Usá comillas CSV para celdas con comas, saltos de línea o comillas. Para un producto nuevo se puede dejar `id` y `slug` vacíos: el servidor los genera a partir del SKU y el nombre. Los SKU existentes identifican actualizaciones; el SKU no se puede cambiar desde una fila que ya corresponde a otro ID.

`stock` representa las unidades físicas que quedan luego de ventas completadas e incluye las que estén temporalmente reservadas. El stock que ve el cliente descuenta además las reservas activas. Así, descargar y volver a subir el mismo archivo no vuelve a descontar ventas ni reserva stock dos veces. Al importar, no se permite bajar el inventario por debajo de una reserva activa. Las variantes son descriptivas; no existe inventario independiente por variante.

Con el backend aún sin publicar, el catálogo del sitio sigue usando los archivos JavaScript estáticos. Cuando se configure la API, el catálogo remoto de SQLite pasa a ser la fuente de productos, precios y stock para inicio, tienda, ficha, carrito y checkout. La base conserva las modificaciones administrativas en reinicios; el catálogo local solo se usa como semilla inicial y como alternativa cuando no se configuró una URL de API.

## Cambiar fotos

Las rutas que usa la tienda están escritas en `images` de cada producto. Copiar una foto a la carpeta **no** cambia por sí solo la ruta ni reemplaza automáticamente el SVG.

1. Prepará una foto propia en formato `.webp`, `.jpg` o `.png`. Se recomienda un encuadre vertical 4:5 y buena resolución.
2. Copiala a `img/products/` con un nombre sencillo, por ejemplo `jarra-vidrio-1-litro.webp`.
3. Cambiá la ruta en el producto: `images: ["img/products/jarra-vidrio-1-litro.webp"]`.
4. Para varias fotos, agregá más rutas a la lista, separadas por comas. La primera será la principal.
5. Recargá `index.html` y abrí la ficha para verificar que se vean.

La [lista de imágenes](./LISTA-IMAGENES.md) contiene nombres sugeridos y placeholders actuales. Cuando uses esas fotos sugeridas, tené en cuenta que hay que conectar sus rutas en `products.js` siguiendo estos pasos. Para cambiar el logo o favicon, reemplazá `assets/logo.svg` o `assets/favicon.svg` conservando el nombre y formato, o actualizá las referencias en las páginas.

## Editar categorías

Abrí `js/data/categories.js`. Cada categoría tiene `id`, `name`, `slug`, `image`, `description` y `order`. Para corregir el nombre, descripción o imagen, editá esos campos. La imagen debe estar en `img/categories/` y su ruta debe coincidir exactamente.

Los productos relacionan la categoría mediante su `id` en `products.js`. Si creás una categoría nueva, usá un `id` y `slug` únicos y asigná ese mismo `id` a los productos correspondientes. “Ofertas” es una sección virtual que se calcula a partir de las etiquetas y los precios; no la uses como categoría de productos.

## Cambiar datos del negocio

Editá `js/config.js` con el editor de texto:

- `brand`: nombre, frase y ruta del logo.
- `contact`: WhatsApp internacional sin `+`, email, Instagram sin `@` y horario. Completá los datos definitivos antes de publicar.
- `shipping`: zonas, costos estimados, retiro y mínimo de envío gratis.
- `payments`: el texto de cuotas y el descuento de transferencia.
- `legal`: razón social/nombre comercial y CUIT.

Los precios de productos y costos de envío se escriben como números enteros en pesos, sin símbolos ni separadores, por ejemplo `89900`. Confirmá los importes y condiciones antes de publicarlos. No agregues contraseñas, claves ni tokens a `config.js`: el contenido del sitio es público.

## Publicar la tienda

La tienda en su configuración predeterminada de WhatsApp no necesita un servidor propio ni un comando de compilación. Mercado Pago TEST requiere además publicar y configurar el backend que se describe más abajo. Publicá **el contenido de esta carpeta** como raíz del sitio —incluidos `index.html`, `404.html`, `css/`, `js/`, `img/` y `assets/`—; no publiques solo los HTML.

### Opción A: Netlify Drop

1. Terminá las comprobaciones de la sección [Antes de publicar](#antes-de-publicar-checklist).
2. Ingresá al servicio de Netlify con la cuenta del titular del negocio y elegí la opción de desplegar manualmente una carpeta (Netlify Drop).
3. Arrastrá la carpeta del proyecto al área de carga. Si el servicio pide una carpeta de publicación, usá esta carpeta del proyecto. No hace falta configurar comando de build.
4. Esperá el enlace de prueba que genera el servicio, abrilo y repetí las pruebas de compra y contacto.
5. Configurá el dominio propio cuando esté definido. El archivo `404.html` está preparado para servir como página de error en hosting estático.

Un despliegue manual puede requerir volver a subir la carpeta cada vez que cambies el catálogo o el diseño.

### Opción B: GitHub Pages

1. Subí los archivos del proyecto a un repositorio de GitHub bajo la cuenta del titular. No incluyas credenciales ni archivos `.env`.
2. En el repositorio, abrí **Settings → Pages** y elegí publicar desde la rama y carpeta donde están `index.html` y el resto del sitio (normalmente la raíz, `/`).
3. Guardá la configuración, esperá a que termine el despliegue y abrí la URL publicada.
4. Repetí las pruebas y configurá el dominio propio cuando esté definido.

El sitio usa rutas relativas y está preparado para hosting estático y apertura local. En cualquier proveedor, verificá que las rutas de páginas, imágenes, estilos y scripts carguen bien en la URL pública, especialmente si se publica dentro de una subcarpeta.

### Opción C: Vercel

1. Subí los archivos a un repositorio de GitHub bajo la cuenta del titular (igual que en la Opción B).
2. En Vercel, elegí **Add New → Project** e importá ese repositorio.
3. En la configuración del proyecto, dejá **Framework Preset: Other**, **Build Command vacío** y **Output Directory: la raíz** (`.`). La tienda no se compila: se publica tal cual.
4. Desplegá, abrí la URL de prueba y repetí las pruebas de compra y contacto.
5. Cada vez que subas cambios al repositorio, Vercel vuelve a publicar el sitio automáticamente.

En Vercel y en cualquier hosting, `404.html` se puede configurar como página de error personalizada, pero el nombre exacto y el lugar de configuración dependen del proveedor. Si no la configura, el sitio igual funciona; solo se ve la página de error genérica.

## Entrega de la Fase 1

Esta es la tienda completa **sin backend obligatorio**: se abre con doble clic, se publica como sitio estático y el pedido se envía por WhatsApp. Sirve para empezar a mostrar el catálogo y recibir consultas mientras se define cómo se cobra.

### Qué incluye

| Pieza | Estado |
| --- | --- |
| Catálogo con 24 productos, 9 categorías, filtros, búsqueda y orden | Listo |
| Ficha de producto con galería, variantes, stock y relacionados | Listo |
| Carrito persistente, mini-carrito y página de carrito | Listo |
| Checkout por pasos con validaciones argentinas y envío por zona | Listo |
| Pedido por WhatsApp con resumen automático | Listo |
| Páginas de contacto, envíos, términos, privacidad y arrepentimiento | Plantillas base |
| SEO (títulos, descripciones, sitemap, robots, datos estructurados) | Listo |
| Accesibilidad y diseño responsive (360, 768, 1024 y 1440 px) | Listo |

### Cómo se verificó

- Consola del navegador sin errores ni advertencias en las 12 páginas públicas.
- Sin desplazamiento horizontal en las 12 páginas en los cuatro anchos de pantalla.
- Auditoría automática de accesibilidad, buenas prácticas y SEO: 100/100/100 en tema claro y oscuro (página de inicio).
- Pruebas automatizadas del backend (92) aprobadas, aunque el backend no sea necesario para esta fase.
- El detalle de cada etapa queda en `CHANGELOG.md`.

### Qué falta antes de vender de verdad

1. **Fotos reales** de los productos y categorías (hoy son placeholders): ver [Cambiar fotos](#cambiar-fotos) y la [lista de imágenes](./LISTA-IMAGENES.md).
2. **Precios, stock y envíos confirmados** por el negocio.
3. **Textos legales revisados** por contador o abogado, con razón social y CUIT definitivos.
4. **Dominio propio** reemplazando `https://TU-DOMINIO.example` (ver [SEO](#seo-url-del-sitio-y-metadatos)).
5. **WhatsApp y datos de contacto reales** en `js/config.js`.
6. **Publicación** en el hosting elegido y prueba final desde el teléfono.

> Nada de esto bloquea la revisión: la tienda se puede navegar y probar completa hoy mismo con los datos de ejemplo.

## API de catálogo y pagos — backend Fase 2

El backend está en `server/`, separado de la tienda estática. Requiere Node.js 20 o posterior.

1. Abrí una terminal dentro de la carpeta `server/`.
2. Ejecutá `npm install` para instalar las dependencias, incluidos Express, SQLite y el SDK de Mercado Pago.
3. Copiá `server/.env.example` a `server/.env`. Ajustá `PORT`, `FRONTEND_URL`, `PUBLIC_API_URL` y `CORS_ORIGIN` al entorno de prueba. `ORDER_RESERVATION_MINUTES` vale 30 por defecto.
4. Para Mercado Pago TEST, cargá `MP_ACCESS_TOKEN` con un Access Token que empiece con `TEST-` y `MP_WEBHOOK_SECRET` con la firma secreta de Webhooks de esa aplicación, obtenidos por el titular desde Mercado Pago. Guardalos solo en `server/.env`; nunca los compartas por chat ni los copies a `js/config.js`, HTML o el repositorio.
5. Para conectar el catálogo y registrar/reservar pedidos coordinados por WhatsApp, configurá `payments.apiBaseUrl` en `js/config.js` con la URL HTTPS de la API y mantené `payments.provider` en `"whatsapp"`. Para probar Mercado Pago, además cambiá el proveedor a `"mercadopago"` y configurá credenciales TEST y webhook.
6. Publicá una versión de prueba del frontend con HTTPS. Para el webhook, `PUBLIC_API_URL` debe ser una URL HTTPS públicamente accesible del backend (por ejemplo, un entorno de prueba o túnel HTTPS); `localhost` no puede recibir avisos de Mercado Pago.
7. Ejecutá `npm start` desde `server/`. Comprobá `/api/health` y `/api/products`; luego probá un pedido usando únicamente el sandbox de Mercado Pago y un usuario/medio de pago de prueba.
8. Ejecutá `npm test` desde `server/` para correr las pruebas automatizadas. Estas usan un gateway simulado y no realizan cobros.

El backend crea `server/data/orders.sqlite`. Las categorías se sincronizan desde `js/data/categories.js`; los productos de esos archivos se insertan solo si todavía no existen, para que no se pierdan los cambios CSV al reiniciar. Los pedidos, movimientos y reservas se mantienen en SQLite. La carpeta `server/data/` no se sube al repositorio.

Configuración del servidor: `PORT` (3000 por defecto), `DB_PATH` (`./data/orders.sqlite`), `NODE_ENV`, `TRUST_PROXY_HOPS` (0 por defecto; número de proxies de confianza del hosting), `FRONTEND_URL`, `PUBLIC_API_URL`, `CORS_ORIGIN` (orígenes permitidos separados por comas), `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ADMIN_PASSWORD` y `ORDER_RESERVATION_MINUTES` (30 por defecto; acepta de 1 a 1440). `BASE_URL` solo se admite como alias anterior de `PUBLIC_API_URL`. `MP_ACCESS_TOKEN` debe ser de prueba (`TEST-`); el servidor rechaza tokens de producción. Para crear preferencias también se exige configurar el secreto del webhook. No agregues secretos a archivos del frontend.

Rutas disponibles: `GET /api/health`, `GET /api/products`, `GET /api/products/:slug`, `POST /api/orders/whatsapp`, `POST /api/checkout`, `POST /api/webhooks/mercadopago` y `GET /api/orders/:id`. El servidor obtiene precios, zonas, descuentos y stock desde su catálogo/configuración; no confía en los precios ni los totales del navegador. Cuando está conectado al backend, cada solicitud de WhatsApp se registra y reserva stock por 30 minutos; el panel permite cancelar la solicitud y liberar esa reserva. Mercado Pago también reserva inventario, verifica la firma `x-signature` del webhook con el SDK oficial y consulta el pago antes de aplicar cambios. No se fija una antigüedad máxima de firma para no descartar reintentos legítimos; los pagos se consultan en la API y se procesan idempotentemente. El estado público del pedido no expone email, DNI, teléfono ni dirección.

Los avisos de correo todavía no se envían: el proveedor/remitente está pendiente de elección. El servidor registra internamente los eventos previstos, con estado `disabled`: aviso al vendedor al crear un pedido WhatsApp, aviso al vendedor tras un pago aprobado y confirmación al comprador solo tras un pago aprobado. No se requiere ni se guarda una credencial de correo hasta elegir el proveedor y activar una implementación de envío.

### Preparación de despliegue del backend (Render u otro host)

La aplicación valida la configuración al arrancar con `NODE_ENV=production`: exige URLs HTTPS para el frontend y la API, que CORS incluya el origen del frontend, una ruta absoluta para SQLite en disco persistente y, si se configura el token TEST, también el secreto del webhook. Rechaza credenciales de Mercado Pago que no empiecen con `TEST-`; la integración no admite cobros reales.

En Render, por ejemplo:

1. Creá un servicio web desde la carpeta `server/`, con `npm install` como comando de instalación y `npm start` como inicio. Usá una versión de Node compatible (20 o posterior).
2. Asociá un disco persistente montado en `/var/data` y definí `DB_PATH=/var/data/orders.sqlite`. Sin almacenamiento persistente, pedidos y reservas podrían perderse al reiniciar o desplegar.
3. Configurá como variables privadas `NODE_ENV=production`, `TRUST_PROXY_HOPS=1` (si el host usa un único proxy de confianza), `FRONTEND_URL` (origen HTTPS exacto del sitio), `PUBLIC_API_URL` (URL HTTPS pública de la API), `CORS_ORIGIN` (origen del sitio, sin rutas), y, para activar Mercado Pago TEST, `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` de la misma aplicación de pruebas.
4. En el panel de desarrolladores de Mercado Pago, configurá la URL de Webhooks de prueba como `PUBLIC_API_URL` + `/api/webhooks/mercadopago`, habilitá eventos de pago, y guardá el secreto generado como `MP_WEBHOOK_SECRET`. El backend debe ser públicamente accesible por HTTPS para recibir avisos.
5. Para habilitar el panel privado de pedidos, configurá `ADMIN_PASSWORD` como variable secreta del hosting; usá una contraseña aleatoria larga (al menos 16 caracteres) y guardala también en un gestor de contraseñas. Sin esa variable, `/admin` y sus rutas API devuelven `404`. En Render, configurá `TRUST_PROXY_HOPS=1` para que el backend identifique correctamente el proxy HTTPS y limite los intentos fallidos por IP. La sesión del panel dura una hora; cerrar sesión la invalida.
6. Abrí `https://<api-host>/admin` para iniciar sesión. El panel lista pedidos almacenados en el backend, muestra contacto/dirección (no DNI), permite cambios auditados en el estado operativo de pagos aprobados y cancelar solicitudes WhatsApp para liberar stock. No altera pagos ni emite reembolsos.
7. Desplegá el frontend estático por separado. Configurá `payments.apiBaseUrl` para conectar el catálogo remoto y registrar reservas por WhatsApp. Dejá `payments.provider` en `"whatsapp"` hasta validar URL, CORS, token TEST, secreto y webhook; luego podés configurar `"mercadopago"` para probar.
8. Confirmá `/api/health`, el catálogo y un flujo sandbox completo: pago aprobado, rechazado/pendiente, retorno a gracias, consulta de estado y reintento del mismo webhook. No uses cuentas ni medios de pago reales.

El archivo SQLite local está pensado para una sola instancia del backend con disco persistente. No habilites réplicas múltiples ni despliegues simultáneos que compartan ese archivo; para escalar, primero se debe migrar a una base de datos administrada compatible. El registro de auditoría del panel guarda cada cambio operativo con hora y estado anterior/nuevo, sin copiar datos del cliente.

Esta guía prepara un despliegue de prueba con configuración reforzada, no autoriza ni habilita producción de pagos. La clave privada y el código solo admiten modo TEST y la URL sandbox. La prueba de extremo a extremo con Mercado Pago requiere credenciales/usuario de prueba y un dominio del titular, que aún no están configurados; no se debe anunciar como completada hasta realizarla.

## Límites importantes de esta versión

- En la configuración inicial el checkout sigue usando WhatsApp. Al activar `"mercadopago"`, la compra se procesa solo en modo de prueba hasta completar la preparación y autorización de producción; no cargues datos reales.
- En el modo Mercado Pago (TEST), el pedido y los datos necesarios de contacto/entrega se guardan en SQLite del servidor y se envían al proveedor para crear la preferencia. Si `payments.apiBaseUrl` está configurada, los pedidos WhatsApp también se registran en SQLite antes de abrir el enlace y conservan una reserva temporal; sin API configurada sigue disponible el flujo directo heredado, sin reserva central. El comprobante local no guarda datos personales.
- El panel de administración es opcional y solo muestra pedidos registrados en el backend. El estado de pago de una coordinación WhatsApp no se verifica automáticamente; Mercado Pago se confirma mediante webhook.
- Los precios, cuotas, descuentos, stock y costos de entrega son datos configurados y deben mantenerse actualizados. Las tarifas de envío se confirman al coordinar el pedido.
- Los textos de términos, privacidad, envíos y devoluciones, y arrepentimiento son **plantillas base**, no asesoramiento legal. Antes de publicar o aceptar pedidos, el titular debe validarlos con su contador o abogado y completar los datos comerciales y legales que correspondan.
- Nunca publiques credenciales de pago ni cambies a credenciales de producción sin autorización expresa del titular.
- Antes de aceptar pagos reales, se deben revisar la política de privacidad, la conservación de datos, la seguridad del webhook y la configuración de producción. El soporte de credenciales reales no está implementado y requiere autorización expresa del titular.

## Antes de publicar: checklist

- [ ] Revisar nombre, WhatsApp, email, redes, horario, razón social y CUIT en `js/config.js`.
- [ ] Confirmar precios, ofertas, stock, variantes y tarifas de envío.
- [ ] Cambiar placeholders por fotos correctas y comprobar cada ruta.
- [ ] Revisar textos legales con un profesional y completar los datos que faltan.
- [ ] Reemplazar `https://TU-DOMINIO.example` por el dominio real en `js/config.js`, `robots.txt` y `sitemap.xml`.
- [ ] Abrir las páginas principales, probar catálogo y filtros, carrito y checkout.
- [ ] Probar WhatsApp o, si se habilitó Mercado Pago, completar el flujo solo con credenciales y medios de pago TEST.
- [ ] Probar la web publicada desde teléfono y computadora; corregir enlaces, imágenes o páginas que fallen.
- [ ] Definir y probar un medio de contacto para recibir y responder las solicitudes.

## SEO: URL del sitio y metadatos

La tienda ya trae los archivos de SEO en la raíz:

- `sitemap.xml` — mapa de las páginas principales para Google.
- `robots.txt` — reglas para los rastreadores (apunta al sitemap).
- `js/core/seo.js` — agrega en cada página la URL canónica, la imagen para compartir (`og:image` — ya existe en `assets/og-image.png`, 1200×630) y los datos de la marca (Organization).

Todos usan la misma URL base: `https://TU-DOMINIO.example`. **Cuando tengas el dominio, reemplazá ese texto por la dirección real en tres archivos** (buscar y reemplazar):

1. `js/config.js` → `site.url`
2. `robots.txt`
3. `sitemap.xml`

Mientras no se reemplace, el sitio detecta el placeholder y usa la dirección actual automáticamente: probar en local no se rompe nada.

Otras cosas ya configuradas:

- Las páginas de carrito, checkout, gracias y `estilos.html` están marcadas `noindex` (Google no las indexa).
- Las fichas de producto comparten con tarjeta grande (`summary_large_image`).
- Para cambiar la imagen que aparece al compartir, reemplazá `assets/og-image.png` por una foto real de 1200×630 px.
- Cuando haya dominio, registrá el sitemap en Google Search Console.
