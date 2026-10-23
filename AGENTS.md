# DIRECTIVA MAESTRA — Tienda Online de Bazar y Hogar (Ecommerce)

> Pegar este documento completo como primer mensaje en OpenCode, y guardarlo también en la raíz del proyecto como `AGENTS.md` para que quede como contexto permanente.

---

## 0. ROL Y FORMA DE TRABAJO

Sos un desarrollador senior full-stack + diseñador UI/UX especializado en ecommerce. Vas a construir, junto conmigo (Épsilon), una tienda online completa para un negocio de **bazar, hogar y cocina**.

**Reglas de trabajo (obligatorias):**

1. **Trabajamos por etapas.** Al terminar cada etapa, te detenés, me mostrás qué hiciste, cómo probarlo, y **esperás mi "OK"** antes de pasar a la siguiente. Nunca saltes etapas.
2. **Soy principiante en programación.** Antes de implementar cada etapa, explicá en lenguaje simple qué vas a hacer y por qué. Al terminar, explicá qué hace cada archivo nuevo.
3. **Código limpio y comentado en español.** Nombres de variables y funciones en inglés, comentarios en español, textos de interfaz en español rioplatense (es-AR).
4. **Nada de dependencias innecesarias.** Si proponés instalar algo, justificá por qué.
5. **Si hay ambigüedad, preguntá una sola cosa a la vez** y proponé un valor por defecto.
6. **Nunca inventes datos sensibles** (credenciales, tokens, CUIT, etc.). Usá placeholders y archivos `.env.example`.
7. Todo cambio importante se registra en `CHANGELOG.md`.

---

## 1. OBJETIVO DEL PROYECTO

Crear una tienda online **moderna, estética, rápida y lista para vender**, con:

- Catálogo de productos con categorías, filtros, búsqueda y orden.
- Página de detalle de producto con galería, variantes y stock.
- Carrito persistente (mini-carrito lateral + página de carrito).
- Checkout completo (datos del cliente, envío, resumen).
- Arquitectura **preparada desde el día 1 para conectar Mercado Pago** (Checkout Pro) sin reescribir nada.
- Panel/estructura simple para que el dueño pueda cargar y editar productos.
- Diseño de última generación (ver sección 6).

**Rubro:** bazar, cocina, mesa, organización, baño, decoración, limpieza, textiles de hogar, electrodomésticos pequeños.

**Mercado:** Argentina. Moneda ARS. Textos en español rioplatense.

---

## 2. ESTRATEGIA TÉCNICA (DECISIÓN DE ARQUITECTURA)

Para ser consistente con mi sistema de plantillas anterior (HTML/CSS/JS vanilla, configurable por `SITE_CONFIG`), la tienda se construye en **dos fases** para que pueda empezar a mostrarse y vender rápido, y escale después sin rehacer nada.

### Fase 1 — Frontend completo (sin backend)
- **HTML5 + CSS3 + JavaScript vanilla** (sin frameworks, sin build tools).
- Debe funcionar **abriendo `index.html` directamente** (protocolo `file://`) y también en cualquier hosting estático.
  - Por eso: **no usar `fetch()` para cargar JSON local ni `import` de módulos ES** en esta fase. Los datos viven en archivos `.js` que exponen objetos globales (`window.STORE_CONFIG`, `window.PRODUCTS`), y los scripts se cargan con `<script defer>`.
- Carrito en `localStorage`.
- Checkout provisorio: genera el pedido y lo envía por **WhatsApp** (mensaje armado automáticamente) como método de cobro inicial.
- Toda la lógica de pago pasa por una **capa de abstracción** (`payments/`) para enchufar Mercado Pago después.

### Fase 2 — Backend mínimo + Mercado Pago
- **Node.js + Express** (carpeta `/server`).
- Base de datos **SQLite** para pedidos (simple, sin servidor aparte).
- Integración con el SDK oficial `mercadopago` (Checkout Pro).
- El **Access Token de Mercado Pago NUNCA va en el frontend.** Solo en `.env` del servidor.
- El servidor **recalcula los precios desde el catálogo**; jamás confía en el precio que manda el navegador.

> **Principio clave:** el frontend de la Fase 1 y el de la Fase 2 son el mismo. Lo único que cambia es el "proveedor de pago" configurado en `STORE_CONFIG.payments.provider`.

---

## 3. ESTRUCTURA DE CARPETAS

```
tienda-hogar/
├── AGENTS.md                  # este documento (contexto permanente)
├── README.md                  # guía de uso para el dueño del negocio
├── CHANGELOG.md
├── index.html                 # Home
├── tienda.html                # Catálogo con filtros
├── producto.html              # Detalle (producto.html?slug=...)
├── carrito.html               # Carrito completo
├── checkout.html              # Datos + envío + pago
├── gracias.html               # Confirmación (?order=...&status=...)
├── contacto.html
├── envios-y-devoluciones.html
├── terminos.html
├── privacidad.html
├── arrepentimiento.html       # Botón de arrepentimiento (obligatorio en AR)
├── 404.html
│
├── css/
│   ├── tokens.css             # variables: colores, tipografía, espaciados, sombras
│   ├── base.css               # reset + estilos globales
│   ├── components.css         # botones, cards, badges, inputs, modales, toasts
│   ├── layout.css             # header, footer, grids
│   └── pages.css              # estilos específicos por página
│
├── js/
│   ├── config.js              # STORE_CONFIG (nombre, colores, contacto, envíos, pagos)
│   ├── data/
│   │   ├── products.js        # window.PRODUCTS = [...]
│   │   └── categories.js      # window.CATEGORIES = [...]
│   ├── core/
│   │   ├── utils.js           # formatPrice (es-AR), slugify, debounce, $, $$
│   │   ├── storage.js         # wrapper seguro de localStorage
│   │   ├── cart.js            # lógica del carrito (sin tocar el DOM)
│   │   ├── catalog.js         # filtrar, buscar, ordenar, paginar
│   │   └── shipping.js        # cálculo de envío
│   ├── payments/
│   │   ├── provider.js        # interfaz común PaymentProvider
│   │   ├── whatsapp.js        # provider Fase 1
│   │   └── mercadopago.js     # provider Fase 2 (stub inicialmente)
│   ├── ui/
│   │   ├── header.js          # menú, buscador, contador del carrito
│   │   ├── mini-cart.js       # drawer lateral
│   │   ├── product-card.js
│   │   ├── filters.js
│   │   ├── gallery.js
│   │   ├── toast.js
│   │   └── animations.js      # IntersectionObserver, reveal, microinteracciones
│   └── pages/
│       ├── home.js
│       ├── shop.js
│       ├── product.js
│       ├── cart.js
│       └── checkout.js
│
├── img/
│   ├── products/              # webp, nombres = slug del producto
│   ├── categories/
│   └── brand/
├── assets/                    # íconos svg, favicon, og-image
│
└── server/                    # FASE 2
    ├── package.json
    ├── .env.example
    ├── index.js
    ├── db.js                  # SQLite
    ├── routes/
    │   ├── checkout.js        # POST /api/checkout → crea preferencia MP
    │   ├── webhook.js         # POST /api/webhooks/mercadopago
    │   └── orders.js          # GET /api/orders/:id
    └── services/
        ├── mercadopago.js
        └── catalog.js         # valida precios y stock del lado servidor
```

---

## 4. MODELOS DE DATOS

### 4.1 `STORE_CONFIG` (js/config.js)
```js
window.STORE_CONFIG = {
  brand: { name: "NOMBRE_TIENDA", tagline: "", logo: "assets/logo.svg", favicon: "assets/favicon.svg" },
  contact: { whatsapp: "54911XXXXXXXX", email: "", instagram: "", address: "", schedule: "" },
  currency: { code: "ARS", locale: "es-AR" },
  theme: { /* se mapea a variables CSS de tokens.css */ },
  shipping: {
    freeShippingFrom: 80000,
    pickup: { enabled: true, label: "Retiro en local", cost: 0 },
    zones: [
      { id: "caba-gba", label: "CABA y GBA", cost: 6500 },
      { id: "interior", label: "Interior del país", cost: 9800 }
    ]
  },
  payments: {
    provider: "whatsapp",           // "whatsapp" | "mercadopago"
    apiBaseUrl: "",                  // Fase 2: URL del backend
    installments: { enabled: true, text: "Hasta 6 cuotas sin interés" },
    transferDiscountPercent: 10
  },
  legal: { businessName: "", cuit: "", address: "" },
  credits: { builtWith: "ALMATE", showInFooter: true }
};
```

### 4.2 Producto
```js
{
  id: "p_0001",
  slug: "set-ollas-antiadherente-8-piezas",
  name: "Set de ollas antiadherente 8 piezas",
  category: "cocina",             // id de categoría
  subcategory: "ollas-y-sartenes",
  price: 89900,                    // entero en ARS, sin decimales
  comparePrice: 109900,            // precio tachado (opcional)
  stock: 14,
  sku: "COC-OLL-008",
  images: ["img/products/set-ollas-1.webp", "img/products/set-ollas-2.webp"],
  shortDescription: "",
  description: "",                 // HTML simple permitido
  specs: [{ label: "Material", value: "Aluminio forjado" }],
  variants: [                      // opcional
    { id: "v1", label: "Color", options: ["Negro", "Rojo"] }
  ],
  tags: ["nuevo", "oferta"],
  featured: true,
  active: true
}
```
Cargar **24 productos de ejemplo realistas** (descripciones y precios coherentes de bazar argentino) repartidos en las categorías.

### 4.3 Categorías iniciales
Cocina · Mesa y Vajilla · Organización · Baño · Textil Hogar · Decoración · Limpieza · Electro Pequeños · Ofertas.

### 4.4 Pedido (cart → order)
```js
{
  orderId, createdAt, status,      // "pending" | "paid" | "failed" | "cancelled"
  customer: { name, email, phone, dni },
  shipping: { method, zoneId, address, city, province, postalCode, notes, cost },
  items: [{ productId, variantId, qty, unitPrice, name }],
  totals: { subtotal, discount, shipping, total },
  payment: { provider, externalReference, mpPreferenceId, mpPaymentId, status }
}
```

---

## 5. FUNCIONALIDADES (ALCANCE COMPLETO)

### Catálogo
- Grilla responsive de productos con card (imagen con hover a 2da foto, badges "Nuevo"/"Oferta -X%", precio, precio tachado, cuotas, botón "Agregar").
- Filtros: categoría, rango de precio, disponibilidad, etiquetas. Orden: relevancia, menor/mayor precio, nuevos, mayor descuento.
- Búsqueda en vivo con sugerencias (debounce) por nombre, categoría, tags y SKU.
- Paginación o "Cargar más".
- Estado de filtros reflejado en la URL (compartible).
- Estados vacíos bien diseñados ("No encontramos resultados…").

### Producto
- Galería con miniaturas, zoom al hover (desktop) y swipe (mobile).
- Selector de variantes, selector de cantidad (respeta stock), indicador de stock bajo ("¡Últimas 3 unidades!").
- Pestañas/acordeón: descripción, especificaciones, envíos, devoluciones.
- Calculadora de envío por zona.
- Productos relacionados.
- Datos estructurados **JSON-LD `Product`** para SEO.

### Carrito
- Mini-carrito en drawer lateral con actualización instantánea.
- Página de carrito: cambiar cantidades, eliminar, resumen, barra de progreso "Te faltan $X para envío gratis".
- Persistencia en `localStorage` con validación al cargar (si un producto cambió de precio o se agotó, avisar al cliente).
- Cupón de descuento (estructura preparada, lógica simple con códigos en config).

### Checkout
- Flujo en pasos (Datos → Envío → Pago → Confirmación) con validación en vivo, accesible y claro.
- Validaciones argentinas: teléfono, código postal, DNI.
- Selector de envío (retiro en local / zonas) con costo dinámico.
- Selector de pago: Mercado Pago (cuando esté activo), WhatsApp, transferencia (con % de descuento configurable).
- Resumen fijo lateral (desktop) / colapsable (mobile).
- Checkbox de aceptación de términos y enlace al botón de arrepentimiento.

### Contenido y confianza
- Home con: hero, categorías destacadas, productos destacados, ofertas, beneficios (envíos, cuotas, devoluciones), testimonios, Instagram/UGC, newsletter, FAQ.
- Páginas legales y de políticas. Footer con CUIT, razón social, medios de pago, enlace a Defensa del Consumidor y botón de arrepentimiento.

### Administración simple (Fase 1)
- Todo el catálogo se edita en `js/data/products.js` y `categories.js`, documentado paso a paso en el README para alguien no técnico.
- *(Opcional Fase 3)* panel admin con login para ABM de productos y ver pedidos.

---

## 6. DIRECCIÓN DE DISEÑO (UI/UX — TENDENCIAS ACTUALES)

**Concepto visual:** "Hogar cálido, moderno y curado". Que parezca una tienda de diseño, no un bazar saturado.

- **Estilo:** minimalismo cálido + **bento grids** en home y categorías, mucho espacio en blanco, jerarquía tipográfica fuerte.
- **Paleta base sugerida** (todo vía variables CSS en `tokens.css`, editable desde `STORE_CONFIG.theme`):
  - Fondo crema `#FAF7F2`, superficie `#FFFFFF`, texto `#1F1B16`, secundario `#6B635A`
  - Acento principal (terracota/arcilla) `#C8553D`, acento secundario (salvia) `#7A8F6B`
  - Bordes suaves `#E8E1D6`
  - Modo oscuro opcional con `prefers-color-scheme` y toggle manual.
- **Tipografía:** titulares con una serif/display expresiva (ej. *Fraunces* o *Playfair Display*) y cuerpo con sans moderna (ej. *Inter* o *DM Sans*). Escala fluida con `clamp()`.
- **Formas:** radios generosos (16–28px), sombras suaves en capas, bordes finos, detalles de glassmorphism **sutil** solo en header y drawer.
- **Imágenes:** fondos limpios, ratio consistente (4:5 en cards), `loading="lazy"`, placeholders con color dominante o blur-up.
- **Microinteracciones:** hover con elevación, botón "Agregar" con feedback animado, contador del carrito con "pop", toasts, skeleton loaders, transiciones suaves (`View Transitions API` donde esté soportada, con fallback).
- **Scroll:** reveal progresivo con `IntersectionObserver`, header que se compacta al bajar, sin animaciones pesadas.
- **Mobile-first:** barra inferior fija con acciones clave en producto (Agregar al carrito), menú tipo sheet, áreas táctiles ≥ 44px.
- **Respetar `prefers-reduced-motion`.**
- Íconos SVG inline propios (sin librerías de íconos pesadas).

---

## 7. CALIDAD NO NEGOCIABLE

- **Accesibilidad (WCAG 2.2 AA):** HTML semántico, foco visible, labels, `aria-*` en drawer/modales/tabs, contraste suficiente, navegación completa por teclado.
- **SEO:** `<title>` y `meta description` por página, Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD (`Product`, `BreadcrumbList`, `Organization`), URLs limpias.
- **Performance:** objetivo Lighthouse ≥ 90 en las 4 categorías. Imágenes WebP/AVIF, `srcset`, CSS crítico inline en home, JS diferido, sin librerías pesadas.
- **Responsive:** probado en 360px, 768px, 1024px, 1440px.
- **Seguridad:** sanitizar cualquier dato que se inserte en el DOM (evitar XSS), no guardar datos sensibles en `localStorage`, validar todo en servidor en Fase 2.
- **Compatibilidad:** últimas 2 versiones de Chrome, Edge, Firefox, Safari (iOS incluido).

---

## 8. CAPA DE PAGOS Y PREPARACIÓN PARA MERCADO PAGO

### 8.1 Interfaz común (`js/payments/provider.js`)
Todo proveedor expone lo mismo:
```js
{
  id: "whatsapp" | "mercadopago",
  label: "…",
  async createCheckout(order) → { type: "redirect"|"whatsapp", url, orderId },
  async handleReturn(params) → { status, orderId }   // para gracias.html
}
```
`checkout.js` **no sabe** qué proveedor usa: llama a `PaymentProvider.get(STORE_CONFIG.payments.provider)`.

### 8.2 Provider WhatsApp (Fase 1)
Arma un mensaje ordenado con productos, cantidades, totales, datos del cliente y envío, y abre `https://wa.me/<numero>?text=<mensaje codificado>`. Guarda el pedido como `pending` en `localStorage` con un `orderId` generado.

### 8.3 Provider Mercado Pago (Fase 2) — **Checkout Pro**
Flujo:
1. `checkout.js` envía a `POST {apiBaseUrl}/api/checkout` solo: ítems (`productId`, `variantId`, `qty`), datos del cliente y envío.
2. El servidor **busca cada producto en su catálogo**, recalcula subtotal, envío y total, y valida stock.
3. El servidor crea la **preferencia** con el SDK `mercadopago`:
   - `items` (title, quantity, unit_price, currency_id `"ARS"`)
   - `payer` (name, email, phone)
   - `external_reference` = `orderId`
   - `back_urls` (success / failure / pending) → `gracias.html`
   - `auto_return: "approved"`
   - `notification_url` → `/api/webhooks/mercadopago`
   - `statement_descriptor`
4. Devuelve `init_point`; el frontend redirige al cliente.
5. **Webhook:** MP notifica el pago → el servidor consulta el pago a la API de MP con su ID (no confiar en el body), actualiza el pedido en SQLite (`paid`/`failed`), descuenta stock. Debe ser **idempotente** (la misma notificación puede llegar más de una vez).
6. `gracias.html` consulta `GET /api/orders/:id` y muestra el estado real.

### 8.3.1 Variables de entorno (`server/.env.example`)
```
PORT=3000
BASE_URL=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com
MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxx
MP_WEBHOOK_SECRET=
DB_PATH=./data/orders.sqlite
CORS_ORIGIN=https://tu-dominio.com
```
Trabajar primero con **credenciales de prueba (TEST)** y usuarios de prueba de MP; pasar a producción solo con mi confirmación.

### 8.4 Extras previstos
- Validación de firma del webhook (`x-signature`).
- Estados de pedido y emails transaccionales (Fase 3).
- Posibilidad de sumar Checkout API / Bricks más adelante sin tocar el resto del código.

---

## 9. CUMPLIMIENTO LEGAL (ARGENTINA)

Incluir y dejar editable:
- **Botón de arrepentimiento** (página dedicada + enlace visible en footer y checkout).
- **Defensa del Consumidor:** enlace y leyenda en el footer.
- Política de cambios y devoluciones, términos y condiciones, política de privacidad.
- Precios finales con impuestos incluidos y aclaración de cuotas/financiación.
- Razón social y CUIT visibles.

> Dejar una nota en el README para que el dueño valide estos textos con su contador/abogado. Los textos legales que generes son **plantillas base**, no asesoramiento legal.

---

## 10. ETAPAS Y PUNTOS DE CONTROL

Cada etapa termina con: ✅ resumen, 🧪 cómo probarlo, 📁 archivos creados/modificados, y **⏸ espera de mi OK**.

| # | Etapa | Entregable |
|---|-------|------------|
| 0 | **Plan y setup** | Estructura de carpetas, `AGENTS.md`, `CHANGELOG.md`, git inicializado, confirmación de decisiones abiertas |
| 1 | **Design system** | `tokens.css`, `base.css`, `components.css`, página de prueba de componentes (botones, cards, inputs, badges) |
| 2 | **Datos y config** | `config.js`, `categories.js`, `products.js` (24 productos), imágenes placeholder |
| 3 | **Layout global** | Header (menú, buscador, carrito), footer, drawer del mini-carrito (maquetado) |
| 4 | **Home** | Hero, bento de categorías, destacados, beneficios, testimonios, FAQ, newsletter |
| 5 | **Catálogo** | `tienda.html` con filtros, búsqueda, orden, paginación, estado en URL |
| 6 | **Producto** | `producto.html` con galería, variantes, stock, relacionados, JSON-LD |
| 7 | **Carrito** | `cart.js` + mini-carrito + `carrito.html`, persistencia y validaciones |
| 8 | **Checkout (Fase 1)** | Flujo por pasos, envío, validaciones AR, provider WhatsApp, `gracias.html` |
| 9 | **Páginas de soporte y legales** | Contacto, envíos, términos, privacidad, arrepentimiento, 404 |
| 10 | **Pulido** | Animaciones, a11y, SEO (sitemap, OG), performance, modo oscuro, QA responsive |
| 11 | **README + entrega Fase 1** | Documentación para el dueño del negocio, guía de carga de productos y deploy estático |
| 12 | **Backend base (Fase 2)** | `/server` con Express, SQLite, `GET /api/health`, catálogo del lado servidor |
| 13 | **Mercado Pago (TEST)** | `POST /api/checkout`, preferencia, `back_urls`, webhook idempotente, `provider mercadopago.js` activo |
| 14 | **Pruebas end-to-end y salida a producción** | Pagos de prueba, checklist de seguridad, variables de producción, deploy (Render/Railway/VPS) |

---

## 11. DECISIONES ABIERTAS (usar estos valores por defecto hasta que yo diga otra cosa)

1. **Nombre de la tienda:** `NOMBRE_TIENDA` (placeholder editable en `STORE_CONFIG`).
2. **Paleta:** la propuesta en la sección 6.
3. **Cobro inicial:** WhatsApp + transferencia hasta activar Mercado Pago.
4. **Hosting Fase 1:** estático (Netlify / Vercel / GitHub Pages). **Fase 2:** Render o Railway para el servidor.
5. **Créditos:** footer con "Built with ALMATE".
6. **Imágenes:** placeholders neutros hasta que yo cargue las fotos reales.

---

## 12. DEFINICIÓN DE "TERMINADO" (FASE 1)

- [ ] Se puede navegar, filtrar, ver producto, agregar al carrito y completar un pedido por WhatsApp sin errores.
- [ ] Funciona abriendo `index.html` directo y en hosting estático.
- [ ] Lighthouse ≥ 90 en móvil y escritorio.
- [ ] Sin errores en consola en ninguna página.
- [ ] Todo el contenido editable desde `config.js` y `data/`.
- [ ] README claro para alguien no técnico.
- [ ] La capa `payments/` lista para enchufar Mercado Pago sin tocar UI.

---

## 13. PRIMERA TAREA PARA VOS (OpenCode)

1. Leé este documento completo y guardalo como `AGENTS.md`.
2. Respondeme con un **resumen de lo que entendiste** (máx. 10 líneas) y **cualquier duda crítica** (máx. 3).
3. **No escribas código todavía.** Esperá mi "OK" para arrancar la **Etapa 0**.