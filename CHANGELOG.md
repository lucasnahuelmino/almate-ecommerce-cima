# Changelog

Registro de los cambios importantes del proyecto.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

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
