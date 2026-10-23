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
   maneja el modo oscuro). El bloque theme.colors de abajo es una
   REFERENCIA de la paleta para que el dueño tenga los valores a mano.
   ========================================================================== */

window.STORE_CONFIG = {
  /* ---------- Marca ---------- */
  brand: {
    name: "CIMA",
    tagline: "Bazar, hogar y cocina",
    logo: "assets/logo.svg",
    favicon: "assets/favicon.svg"
  },

  /* ---------- Contacto (se muestra en header, footer y checkout) ----------
     Si un campo queda vacío, la interfaz lo oculta automáticamente. */
  contact: {
    whatsapp: "5491134761743",                   // Formato internacional, sin "+" ni espacios
    email: "cima.home@gmail.com",
    instagram: "cima.hogar",                     // Solo el usuario, sin @
    address: "",                                 // Vacío a propósito: no hay local a la calle
    schedule: "De 9 a 18 hs"
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
      label: "Retiro coordinado",                   // Sin local a la calle: se acuerda el punto por WhatsApp
      cost: 0
    },
    zones: [
      { id: "caba-gba", label: "CABA y GBA", cost: 6500 },
      { id: "interior", label: "Interior del país", cost: 9800 }
    ]
  },

  /* ---------- Pagos ----------
     Mercado Pago solo se habilita en una instalación de prueba configurada:
     requiere credenciales TEST privadas en el servidor y una API HTTPS. */
  payments: {
    provider: "whatsapp",
    apiBaseUrl: "",                                 // URL pública HTTPS de la API de prueba
    installments: {
      enabled: true,
      text: "Hasta 6 cuotas sin interés"
    },
    transferDiscountPercent: 10                     // Descuento por transferencia bancaria
  },

  /* ---------- Catálogo remoto (dejar vacío mientras no haya API pública) ---------- */
  catalog: {
    apiBaseUrl: ""
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
    defaultTitle: "CIMA — Bazar, hogar y cocina",
    titleTemplate: "%s — CIMA",
    description: "CIMA — Bazar, cocina, mesa, organización y decoración. Envíos a todo el país. Comprá fácil y seguro.",
    ogImage: "assets/og-image.png"
  },

  /* ---------- Datos legales (visibles en footer — obligatorio en Argentina) ----------
     address vacío a propósito: el negocio no tiene domicilio fiscal público.
     Validar estos textos con contador/abogado. */
  legal: {
    businessName: "Lucas Nahuel Miño",
    cuit: "20-36296907-8",
    address: ""
  },

  /* ---------- Créditos del pie ---------- */
  credits: {
    builtWith: "ALMATE",
    showInFooter: true
  }
};
