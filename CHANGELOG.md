# Changelog

Registro de los cambios importantes del proyecto.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

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
