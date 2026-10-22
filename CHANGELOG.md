# Changelog

Registro de los cambios importantes del proyecto.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

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
