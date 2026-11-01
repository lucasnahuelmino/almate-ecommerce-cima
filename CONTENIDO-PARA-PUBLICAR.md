# Contenido para publicar CIMA

Esta guía reúne **todo lo que falta decidir o cargar antes de abrir la tienda al público**, separado de lo que ya está listo.

No hace falta leer código: cada punto dice qué archivo se toca y qué escribir. Al final hay un comando que revisa sola la parte técnica.

> **Regla de oro:** la tienda ya funciona, pero vende con **contenido de ejemplo**. Publicarla así mostraría fotos provisorias y precios que nadie confirmó.

---

## 1. Revisión automática

Antes y después de cargar contenido, ejecutá en la carpeta del proyecto:

```bash
node tools/check-content.js
```

Qué revisa (sin instalar nada y sin conectarse a internet):

| Marca | Significa |
| --- | --- |
| `[error]` | Bloquea la publicación. Hay que corregirlo (por ejemplo, una imagen que no existe o el catálogo apuntando a `localhost`). |
| `[pendiente]` | Decisión del dueño: fotos reales, precios, dominio, textos legales. No rompe el sitio. |
| `[ok]` | Control que ya está bien. |

Estado de hoy: **0 errores**, **8 pendientes**, **5 controles correctos**.

---

## 2. Fotos de productos

Hoy los 24 productos y las 8 categorías usan **imágenes provisorias `.svg`**. Se ven ordenadas, pero no son fotos reales. El listado archivo por archivo está en [LISTA-IMAGENES.md](./LISTA-IMAGENES.md).

### Cómo preparar las fotos

- Formato **WebP** (o JPG si no tenés con qué convertir). Peso ideal: **menos de 150 KB** por foto.
- Encuadre **vertical 4:5** (por ejemplo 800 × 1000 px), fondo limpio y luz pareja.
- **2 o 3 fotos por producto**: la principal, un detalle y el producto en uso (opcional).
- Nombre del archivo = `slug del producto` + número. Ejemplo:
  - `img/products/set-ollas-antiadherente-8-piezas-1.webp`
  - `img/products/set-ollas-antiadherente-8-piezas-2.webp`

### Dónde se cargan

1. Copiá las fotos a `img/products/`.
2. Abrí `js/data/products.js` y buscá el producto por su `slug`.
3. Reemplazá la línea `images: [...]` por las fotos nuevas, en orden:

```js
images: [
  "img/products/set-ollas-antiadherente-8-piezas-1.webp",
  "img/products/set-ollas-antiadherente-8-piezas-2.webp"
],
```

4. Borrá el `.svg` viejo de ese producto (ya no se usa).

### Fotos de categorías

Igual, pero en `img/categories/` y se cargan en `js/data/categories.js`, campo `image` de cada categoría. La categoría **Ofertas** no lleva imagen: se arma sola con los productos en descuento.

### Imagen para redes (Open Graph)

`assets/og-image.png` es la miniatura que aparece al compartir el link en WhatsApp o Instagram. Hoy es un placeholder de 6,9 KB. Conviene reemplazarlo por una imagen **1200 × 630 px** con el logo y una foto linda de producto.

---

## 3. Precios, ofertas y stock

Estos 24 precios son **de ejemplo** y hay que confirmarlos uno por uno. La columna "Precio anterior" es el precio tachado: si no hay oferta real, se borra (`comparePrice: null`).

| Categoría | Producto | Slug | Precio | Precio anterior | Stock | Foto actual |
| --- | --- | --- | --- | --- | --- | --- |
| Cocina | Set de ollas antiadherente 8 piezas | `set-ollas-antiadherente-8-piezas` | $ 89.900 | $ 109.900 | 14 | `set-ollas-antiadherente-8-piezas.svg` |
| Cocina | Sartén antiadherente 28 cm | `sarten-antiadherente-28cm` | $ 24.900 | — | 22 | `sarten-antiadherente-28cm.svg` |
| Cocina | Set de cuchillos de acero 6 piezas | `set-cuchillos-acero-6-piezas` | $ 45.900 | $ 54.900 | 9 | `set-cuchillos-acero-6-piezas.svg` |
| Mesa y Vajilla | Vajilla completa 12 personas | `vajilla-completa-12-personas` | $ 129.900 | $ 152.900 | 6 | `vajilla-completa-12-personas.svg` |
| Mesa y Vajilla | Set de vasos de vidrio (6 u.) | `set-vasos-vidrio-6` | $ 18.900 | — | 30 | `set-vasos-vidrio-6.svg` |
| Mesa y Vajilla | Mantel de lino beige | `mantel-lino-beige` | $ 27.500 | — | 12 | `mantel-lino-beige.svg` |
| Organización | Set de cajas organizadoras (3 u.) | `set-cajas-organizadoras-3` | $ 21.900 | — | 25 | `set-cajas-organizadoras-3.svg` |
| Organización | Organizador de zapatos modular | `organizador-zapatos-modular` | $ 32.900 | $ 38.900 | 11 | `organizador-zapatos-modular.svg` |
| Organización | Canastos de ratán (2 u.) | `canastos-ratan-2` | $ 26.500 | — | **0** | `canastos-ratan-2.svg` |
| Baño | Toallas de algodón (pack 4) | `toallas-algodon-pack-4` | $ 34.900 | — | 18 | `toallas-algodon-pack-4.svg` |
| Baño | Set de accesorios de baño | `set-accesorios-bano` | $ 22.900 | $ 26.900 | 15 | `set-accesorios-bano.svg` |
| Baño | Dispensador de jabón mate | `dispensador-jabon-mate` | $ 12.900 | — | 40 | `dispensador-jabon-mate.svg` |
| Textil Hogar | Manta tejida beige | `manta-tejida-beige` | $ 42.900 | — | 10 | `manta-tejida-beige.svg` |
| Textil Hogar | Juego de almohadas decorativas (2 u.) | `juego-almohadas-decorativas-2` | $ 29.900 | — | 16 | `juego-almohadas-decorativas-2.svg` |
| Textil Hogar | Cortinas blackout (2 paneles) | `cortinas-blackout-2-paneles` | $ 48.900 | $ 57.900 | **3** | `cortinas-blackout-2-paneles.svg` |
| Decoración | Jarrón de cerámica artesanal | `jarron-ceramica-artesanal` | $ 32.500 | — | **3** | `jarron-ceramica-artesanal.svg` |
| Decoración | Set de velas aromáticas (3 u.) | `set-velas-aromaticas-3` | $ 18.900 | — | 28 | `set-velas-aromaticas-3.svg` |
| Decoración | Cuadro decorativo Abstracto 40x60 | `cuadro-decorativo-40x60` | $ 26.900 | — | **3** | `cuadro-decorativo-40x60.svg` |
| Limpieza | Set de limpieza eco (5 u.) | `set-limpieza-eco-5` | $ 19.900 | $ 23.900 | 20 | `set-limpieza-eco-5.svg` |
| Limpieza | Trapeador giratorio con cubeta | `trapeador-giratorio-cubeta` | $ 38.900 | — | 8 | `trapeador-giratorio-cubeta.svg` |
| Limpieza | Esponjas ecológicas (6 u.) | `esponjas-ecologicas-6` | $ 9.900 | — | 50 | `esponjas-ecologicas-6.svg` |
| Electro Pequeños | Pava eléctrica de acero 1,7 L | `pava-electrica-acero-1-7l` | $ 44.900 | $ 52.900 | 12 | `pava-electrica-acero-1-7l.svg` |
| Electro Pequeños | Tostadora de 2 rebanadas | `tostadora-2-rebanadas` | $ 36.900 | — | 14 | `tostadora-2-rebanadas.svg` |
| Electro Pequeños | Licuadora de vaso 1,5 L | `licuadora-vaso-1-5l` | $ 62.900 | $ 74.900 | 6 | `licuadora-vaso-1-5l.svg` |

### Puntos a confirmar

- **Canastos de ratán**: stock `0`. Si no hay, el sitio los muestra como agotados; si ya no se venden, conviene borrarlos o marcarlos `active: false`.
- **Stock bajo (3 unidades)**: cortinas blackout, jarrón de cerámica y cuadro decorativo. El sitio ya muestra "¡Últimas 3 unidades!".
- **Precio tachado**: solo debe existir si el precio anterior fue real. Un tachado inventado es publicidad engañosa (Ley 24.240).
- Los precios deben ser **finales, con impuestos incluidos**, y coincidir con lo que se cobra por WhatsApp o transferencia.

### Dónde se cambia cada cosa (en `js/data/products.js`)

| Campo | Qué es |
| --- | --- |
| `price` | Precio final en pesos, sin decimales ni puntos (`89900`). |
| `comparePrice` | Precio anterior tachado, o `null` si no hay oferta. |
| `stock` | Unidades disponibles. `0` = agotado. |
| `sku` | Código interno. Sirve para la búsqueda; no se muestra. |
| `name`, `shortDescription`, `description`, `specs` | Textos que lee el cliente. Revisalos: materiales, medidas y qué incluye. |
| `active` | `false` esconde el producto sin borrarlo. |

---

## 4. Condiciones comerciales

Todo esto vive en **`js/config.js`**. Son las condiciones que el cliente ve y acepta al comprar.

| Qué | Dónde | Valor actual | Qué decidir |
| --- | --- | --- | --- |
| Envío gratis desde | `shipping.freeShippingFrom` | $ 80.000 | Si el monto es rentable. |
| Envío CABA y GBA | `shipping.zones[0].cost` | $ 6.500 | Costo real de cadetería. |
| Envío Interior | `shipping.zones[1].cost` | $ 9.800 | Costo real de transporte. |
| Retiro en local | `shipping.pickup` | "Retiro coordinado", $ 0 | Ya está definido. |
| Cuotas | `payments.installments.text` | "Hasta 6 cuotas sin interés" | **Solo si el comercio puede sostener el costo.** Si no, cambiar el texto o poner `enabled: false`. |
| Descuento por transferencia | `payments.transferDiscountPercent` | 10 % | Si conviene mantenerlo. |
| Cupones | `coupons` | `BIENVENIDA10` y `ENVIOGRATIS`, ambos **inactivos** | Si se activan, definir vigencia y mínimo de compra. |

> Las cuotas sin interés se pagan con margen del comercio. Anunciarlas sin poder sostenerlas genera reclamos y pérdidas.

---

## 5. Páginas legales

Cuatro páginas siguen marcadas como **borrador** y lo dicen en pantalla:

- `terminos.html` — Términos y condiciones
- `privacidad.html` — Política de privacidad
- `arrepentimiento.html` — Botón de arrepentimiento
- `envios-y-devoluciones.html` — Envíos, cambios y devoluciones

### Qué hacer

1. Leelas completas (son cortas).
2. Completá los espacios con las condiciones reales: plazos de envío, quién paga el cambio, cuántos días hay para devolver, cómo se reintegra el dinero.
3. **Hacelas validar por tu contador o abogado.** Los textos son plantillas orientativas, no asesoramiento legal.
4. Cuando estén aprobadas, borrá el recuadro `<aside class="legal-template-note">...</aside>` de cada archivo. El verificador deja de marcarlas como pendientes.

### Datos que ya están cargados

| Dato | Valor |
| --- | --- |
| Razón social | Lucas Nahuel Miño |
| CUIT | 20-36296907-8 |
| WhatsApp | 5491134761743 |
| Email | cima.home@gmail.com |
| Instagram | cima.hogar |
| Horario | De 9 a 18 hs |
| Domicilio | No se publica (a propósito) |

El footer ya muestra el enlace a **Defensa del Consumidor** y al **botón de arrepentimiento**, obligatorios en Argentina.

---

## 6. Dominio y buscadores

El dominio todavía es un placeholder: `https://TU-DOMINIO.example`. Aparece en tres lugares y hay que cambiarlo en los tres:

1. `js/config.js` → `site.url` (sin barra final).
2. `sitemap.xml` → todas las etiquetas `<loc>`.
3. `robots.txt` → la línea `Sitemap:`.

Después de publicar, conviene:

- Verificar el sitio en **Google Search Console** y enviar el `sitemap.xml`.
- Probar el link en WhatsApp para ver la miniatura (Open Graph).
- Revisar que las páginas tengan `title` y descripción propios (ya están escritos; solo confirmá que el texto te guste).

---

## 7. Antes de decir "publicado"

- [ ] `node tools/check-content.js` sin `[error]`.
- [ ] Las 24 fotos reales reemplazaron a los `.svg` (o los productos que no se venden están inactivos).
- [ ] Cada producto tiene 2 o 3 fotos.
- [ ] Los 24 precios y los 24 stocks están confirmados.
- [ ] No queda ningún precio tachado inventado.
- [ ] Envío gratis, costos de envío y cuotas confirmados.
- [ ] Las 4 páginas legales están revisadas, completadas y sin la nota de borrador.
- [ ] El dominio reemplazó a `TU-DOMINIO.example` en los tres archivos.
- [ ] La imagen para redes (`assets/og-image.png`) es la definitiva.
- [ ] Probaste una compra completa por WhatsApp desde el celular.
- [ ] Probaste el sitio en un celular real, no solo en la computadora.

Cuando todo eso esté tildado, la Fase 1 queda lista para publicar. Mercado Pago se activa después, con credenciales de prueba y la guía `server/PRUEBA-MERCADOPAGO.md`.
