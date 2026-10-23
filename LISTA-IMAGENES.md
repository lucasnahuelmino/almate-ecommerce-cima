# 📸 Lista de imágenes — cómo reemplazar los placeholders

Mientras no tengas fotos propias, el sitio muestra **imágenes placeholder**: archivos `.svg` con un dibujito simple, el nombre del producto y la leyenda "Foto pendiente".

**Cómo usar tus fotos:** subí el archivo a la carpeta indicada y actualizá la ruta en `images` del producto correspondiente en `js/data/products.js`. Copiar una foto con el nombre sugerido no la conecta automáticamente: el catálogo actualmente apunta a archivos `.svg`. Consultá el [README](./README.md#cambiar-fotos) para los pasos.

## Recomendaciones de foto

- **Formato:** `.webp` (ideal) o `.jpg`
- **Medida mínima:** 1000 px de ancho
- **Relación de aspecto:** **4:5** (por ejemplo 800 × 1000 px) — así entra perfecto en las tarjetas del catálogo
- **Estilo:** fondo limpio y neutro, buena luz, el producto centrado
- **Opcional:** una segunda foto (`...-2.webp`) que se muestra al pasar el mouse sobre la tarjeta

## Productos (24) — carpeta: `img/products/`

| # | Producto | Categoría | Archivo a subir (foto principal) | Foto extra (opcional) |
|---|----------|-----------|----------------------------------|-----------------------|
| 1 | Set de ollas antiadherente 8 piezas | Cocina | `set-ollas-antiadherente-8-piezas-1.webp` | `set-ollas-antiadherente-8-piezas-2.webp` |
| 2 | Sartén antiadherente 28 cm | Cocina | `sarten-antiadherente-28cm-1.webp` | `sarten-antiadherente-28cm-2.webp` |
| 3 | Set de cuchillos de acero 6 piezas | Cocina | `set-cuchillos-acero-6-piezas-1.webp` | `set-cuchillos-acero-6-piezas-2.webp` |
| 4 | Vajilla completa 12 personas | Mesa y Vajilla | `vajilla-completa-12-personas-1.webp` | `vajilla-completa-12-personas-2.webp` |
| 5 | Set de vasos de vidrio (6 u.) | Mesa y Vajilla | `set-vasos-vidrio-6-1.webp` | `set-vasos-vidrio-6-2.webp` |
| 6 | Mantel de lino beige | Mesa y Vajilla | `mantel-lino-beige-1.webp` | `mantel-lino-beige-2.webp` |
| 7 | Set de cajas organizadoras (3 u.) | Organización | `set-cajas-organizadoras-3-1.webp` | `set-cajas-organizadoras-3-2.webp` |
| 8 | Organizador de zapatos modular | Organización | `organizador-zapatos-modular-1.webp` | `organizador-zapatos-modular-2.webp` |
| 9 | Canastos de ratán (2 u.) | Organización | `canastos-ratan-2-1.webp` | `canastos-ratan-2-2.webp` |
| 10 | Toallas de algodón (pack 4) | Baño | `toallas-algodon-pack-4-1.webp` | `toallas-algodon-pack-4-2.webp` |
| 11 | Set de accesorios de baño | Baño | `set-accesorios-bano-1.webp` | `set-accesorios-bano-2.webp` |
| 12 | Dispensador de jabón mate | Baño | `dispensador-jabon-mate-1.webp` | `dispensador-jabon-mate-2.webp` |
| 13 | Manta tejida beige | Textil Hogar | `manta-tejida-beige-1.webp` | `manta-tejida-beige-2.webp` |
| 14 | Juego de almohadas decorativas (2 u.) | Textil Hogar | `juego-almohadas-decorativas-2-1.webp` | `juego-almohadas-decorativas-2-2.webp` |
| 15 | Cortinas blackout (2 paneles) | Textil Hogar | `cortinas-blackout-2-paneles-1.webp` | `cortinas-blackout-2-paneles-2.webp` |
| 16 | Jarrón de cerámica artesanal | Decoración | `jarron-ceramica-artesanal-1.webp` | `jarron-ceramica-artesanal-2.webp` |
| 17 | Set de velas aromáticas (3 u.) | Decoración | `set-velas-aromaticas-3-1.webp` | `set-velas-aromaticas-3-2.webp` |
| 18 | Cuadro decorativo Abstracto 40x60 | Decoración | `cuadro-decorativo-40x60-1.webp` | `cuadro-decorativo-40x60-2.webp` |
| 19 | Set de limpieza eco (5 u.) | Limpieza | `set-limpieza-eco-5-1.webp` | `set-limpieza-eco-5-2.webp` |
| 20 | Trapeador giratorio con cubeta | Limpieza | `trapeador-giratorio-cubeta-1.webp` | `trapeador-giratorio-cubeta-2.webp` |
| 21 | Esponjas ecológicas (6 u.) | Limpieza | `esponjas-ecologicas-6-1.webp` | `esponjas-ecologicas-6-2.webp` |
| 22 | Pava eléctrica de acero 1,7 L | Electro Pequeños | `pava-electrica-acero-1-7l-1.webp` | `pava-electrica-acero-1-7l-2.webp` |
| 23 | Tostadora de 2 rebanadas | Electro Pequeños | `tostadora-2-rebanadas-1.webp` | `tostadora-2-rebanadas-2.webp` |
| 24 | Licuadora de vaso 1,5 L | Electro Pequeños | `licuadora-vaso-1-5l-1.webp` | `licuadora-vaso-1-5l-2.webp` |

## Categorías (8) — carpeta: `img/categories/`

| Categoría | Archivo a subir |
|-----------|-----------------|
| Cocina | `cocina.webp` |
| Mesa y Vajilla | `mesa-vajilla.webp` |
| Organización | `organizacion.webp` |
| Baño | `bano.webp` |
| Textil Hogar | `textil-hogar.webp` |
| Decoración | `decoracion.webp` |
| Limpieza | `limpieza.webp` |
| Electro Pequeños | `electro-pequenos.webp` |

> "Ofertas" no tiene imagen: es una sección especial que agrupa los productos con descuento.

## Marca — carpeta `assets/`

| Qué | Qué hacer |
|-----|-----------|
| Logo | Reemplazá el contenido de `assets/logo.svg` por el tuyo (misma ruta), o subí `logo.png` en la misma carpeta y avisame para cambiar la referencia. |
| Ícono del navegador (favicon) | Reemplazá `assets/favicon.svg` por el tuyo. |
| Foto para compartir en redes (og-image) | Pendiente hasta definir el dominio y preparar los metadatos SEO. |

## ⚠️ Nota importante

Los nombres de esta lista son sugerencias: no están conectados al catálogo hasta actualizar las rutas `images` de cada producto en `js/data/products.js`. Para hacerlo, seguí el [paso a paso del README](./README.md#cambiar-fotos). Verificá que los nombres, la extensión y las rutas coincidan exactamente.
