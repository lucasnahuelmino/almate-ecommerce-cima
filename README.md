# CIMA — Bazar, hogar y cocina

Tienda estática hecha con HTML, CSS y JavaScript. No requiere instalar programas ni compilar el proyecto. Se puede revisar abriendo `index.html` y publicar en un hosting estático.

## Índice

- [Abrir y probar la tienda](#abrir-y-probar-la-tienda)
- [Archivos y carpetas principales](#archivos-y-carpetas-principales)
- [Editar productos](#editar-productos)
- [Cambiar fotos](#cambiar-fotos)
- [Editar categorías](#editar-categorías)
- [Cambiar datos del negocio](#cambiar-datos-del-negocio)
- [Publicar la tienda](#publicar-la-tienda)
- [Límites importantes de esta versión](#límites-importantes-de-esta-versión)
- [Antes de publicar: checklist](#antes-de-publicar-checklist)
- [SEO cuando haya un dominio](#seo-cuando-haya-un-dominio)

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

La versión actual no necesita un servidor propio ni un comando de compilación. Publicá **el contenido de esta carpeta** como raíz del sitio —incluidos `index.html`, `404.html`, `css/`, `js/`, `img/` y `assets/`—; no publiques solo los HTML.

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

## Límites importantes de esta versión

- El pedido se prepara para que el cliente lo envíe por WhatsApp. **No se envía automáticamente ni se cobra en la web**; el cliente debe revisar y enviar el mensaje y CIMA confirmar el pedido.
- No hay panel de administración, base de datos ni sistema para que CIMA reciba pedidos en un tablero. El comprobante de referencia se guarda localmente en el navegador del cliente.
- El carrito persiste en el navegador; los datos personales del checkout no se guardan allí. Se incorporan al mensaje de WhatsApp cuando el cliente continúa por ese canal.
- Los precios, cuotas, descuentos, stock y costos de entrega son datos configurados y deben mantenerse actualizados. Las tarifas de envío se confirman al coordinar el pedido.
- Los textos de términos, privacidad, envíos y devoluciones, y arrepentimiento son **plantillas base**, no asesoramiento legal. Antes de publicar o aceptar pedidos, el titular debe validarlos con su contador o abogado y completar los datos comerciales y legales que correspondan.
- No hay pagos Mercado Pago activos en esta fase. Nunca publiques credenciales de pago en archivos del sitio.

## Antes de publicar: checklist

- [ ] Revisar nombre, WhatsApp, email, redes, horario, razón social y CUIT en `js/config.js`.
- [ ] Confirmar precios, ofertas, stock, variantes y tarifas de envío.
- [ ] Cambiar placeholders por fotos correctas y comprobar cada ruta.
- [ ] Revisar textos legales con un profesional y completar los datos que faltan.
- [ ] Abrir las páginas principales, probar catálogo y filtros, carrito y checkout.
- [ ] Hacer un pedido de prueba hasta el paso de WhatsApp; confirmar que el mensaje sea correcto y no enviarlo como pedido real.
- [ ] Probar la web publicada desde teléfono y computadora; corregir enlaces, imágenes o páginas que fallen.
- [ ] Definir y probar un medio de contacto para recibir y responder las solicitudes.

## SEO cuando haya un dominio

La tienda aún no tiene una URL pública canónica. Cuando se elijan el dominio y el hosting, se podrá preparar `sitemap.xml`, revisar los metadatos Open Graph y definir las URLs HTTPS definitivas. No publiques URLs locales `file://` como sitemap.
