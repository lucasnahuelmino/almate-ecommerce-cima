/* ==========================================================================
   config.js — Configuración general de la tienda (window.STORE_CONFIG)
   --------------------------------------------------------------------------
   Es el "panel de control" del negocio. Casi todo lo que el dueño quiera
   cambiar (nombre, contacto, envíos, pagos, datos legales) se cambia acá,
   sin tocar el diseño (css/) ni la lógica (js/core, js/ui).

   IMPORTANTE — datos sensibles:
   Nunca pongas acá contraseñas, tokens ni credenciales. Este archivo lo ve
   cualquier persona que abra el sitio. Las credenciales de Mercado Pago
   viven SOLO en server/.env (Fase 2), nunca acá.

   Los colores oficiales del sitio viven en css/tokens.css (que también
   maneja el modo oscuro). El bloque theme.theme.colors de abajo es una
   REFERENCIA de la paleta para que el dueño tenga los valores a mano.
   ========================================================================== */

window.STORE_CONFIG = {
  /* ---------- Marca ---------- */
  brand: {
    name: "NOMBRE_TIENDA",                       // Reemplazar por el nombre real
    tagline: "Bazar, hogar y cocina",            // Frase corta bajo el logo
    logo: "assets/logo.svg",                     // Ruta del logo
    favicon: "assets/favicon.svg"                // Ícono del navegador
  },

  /* ---------- Contacto (se muestra en header, footer y checkout) ---------- */
  contact: {
    whatsapp: "54911XXXXXXXX",                   // Formato internacional, sin "+" ni espacios
    email: "hola@nombretienda.com.ar",
    instagram: "nombretienda",                   // Solo el usuario, sin @
    address: "Av. Ejemplo 123, Ciudad Autónoma de Buenos Aires",
    schedule: "Lunes a viernes de 10 a 18 h"
  },

  /* ---------- Moneda y formato (es-AR: $ 89.900) ---------- */
  currency: {
    code: "ARS",
    locale: "es-AR"
  },

  /* ---------- Paleta de marca (referencia; lo operativo es tokens.css) ---------- */
  theme: {
    colors: {
      bg: "#FAF7F2",            // Fondo crema
      text: "#1F1B16",          // Texto principal
      accent: "#C8553D",        // Terracota (marca)
      accentStrong: "#B0442D",  // Terracota para botones (mayor contraste)
      sage: "#7A8F6B",          // Salvia (secundario)
      border: "#E8E1D6"         // Bordes suaves
    }
  },

  /* ---------- Envíos ---------- */
  shipping: {
    freeShippingFrom: 80000,                        // Compra mínima para envío gratis (ARS)
    pickup: {
      enabled: true,
      label: "Retiro en local",
      cost: 0
    },
    zones: [
      { id: "caba-gba", label: "CABA y GBA", cost: 6500 },
      { id: "interior", label: "Interior del país", cost: 9800 }
    ]
  },

  /* ---------- Pagos ----------
     provider: "whatsapp" en la Fase 1 (cobro manual por WhatsApp).
     Cuando se active Mercado Pago (Fase 2) se cambia a "mercadopago" y se
     completa apiBaseUrl con la URL del servidor. El resto no cambia. */
  payments: {
    provider: "whatsapp",
    apiBaseUrl: "",                                 // Fase 2: "https://tu-servidor.com"
    installments: {
      enabled: true,
      text: "Hasta 6 cuotas sin interés"
    },
    transferDiscountPercent: 10                     // Descuento por transferencia bancaria
  },

  /* ---------- Cupones de descuento (estructura lista para usar) ----------
     type: "percent" (porcentaje) | "fixed" (monto fijo en pesos)
     active: poné true para activar el cupón. */
  coupons: [
    { code: "BIENVENIDA10", type: "percent", value: 10, minSubtotal: 0, active: false },
    { code: "ENVIOGRATIS", type: "fixed", value: 6500, minSubtotal: 50000, active: false }
  ],

  /* ---------- SEO (metadatos por defecto) ---------- */
  seo: {
    defaultTitle: "NOMBRE_TIENDA — Bazar, hogar y cocina",
    titleTemplate: "%s — NOMBRE_TIENDA",
    description: "Bazar, cocina, mesa, organización y decoración. Envíos a todo el país. Comprá fácil y seguro.",
    ogImage: "assets/og-image.png"
  },

  /* ---------- Datos legales (visibles en footer — obligatorio en Argentina) ---------- */
  legal: {
    businessName: "Razón Social SRL",              // Reemplazar
    cuit: "30-XXXXXXXX-X",                         // Reemplazar
    address: "Av. Ejemplo 123, CABA"
  },

  /* ---------- Créditos del pie ---------- */
  credits: {
    builtWith: "ALMATE",
    showInFooter: true
  }
};
