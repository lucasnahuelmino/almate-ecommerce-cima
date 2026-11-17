/* ==========================================================================
   almate-assistant.config.js — Asistente ALMATE · Configuración de CIMA
   --------------------------------------------------------------------------
   Este archivo es el único que cambia entre plantillas ALMATE.
   El motor (almate-assistant.js) y los estilos (almate-assistant.css) son
   universales: no contienen datos del negocio.

   Reglas de esta configuración:
   - Los datos comerciales se leen de window.STORE_CONFIG para no duplicarlos
     ni quedar desactualizados (WhatsApp, envíos, cuotas, contacto, marca).
   - No se inventan precios, plazos ni condiciones: si un dato no existe en la
     tienda, la respuesta deriva a WhatsApp en lugar de afirmar algo.
   - Los módulos avanzados (IA, catálogo, precios, stock) quedan APAGADOS.
     El futuro ALMATE IA Comercial puede activarlos sin tocar el motor.

   Para cambiar respuestas: editá guidedMenus y faq.
   Para sumar una pregunta: agregá un objeto a faq con id, question, answer y
   keywords. Las keywords se escriben sin acentos y en minúsculas.
   ========================================================================== */

(function () {
  "use strict";

  const store = window.STORE_CONFIG || {};
  const brand = store.brand || {};
  const contact = store.contact || {};
  const shipping = store.shipping || {};
  const payments = store.payments || {};
  const locale = (store.currency && store.currency.locale) || "es-AR";

  // Formato de moneda igual al del resto del sitio: $ 6.500
  const money = (value) => "$ " + Number(value || 0).toLocaleString(locale);
  const clean = (value) => String(value == null ? "" : value).trim();
  const toList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

  const zones = toList(shipping.zones);
  const zoneText = zones.length
    ? zones.map((zone) => zone.label + ": " + money(zone.cost)).join(" · ")
    : "El costo se confirma según la zona.";

  const freeFrom = Number(shipping.freeShippingFrom || 0);
  const transfer = Number(payments.transferDiscountPercent || 0);
  const installments = payments.installments || {};
  const installmentsText = installments.enabled ? clean(installments.text) : "";
  const pickup = shipping.pickup || {};
  const pickupEnabled = pickup.enabled !== false;
  const whatsapp = clean(contact.whatsapp).replace(/\D/g, "");
  const schedule = clean(contact.schedule);

  // Teléfono lindo para mostrar: 5491134761743 → +54 9 11 3476-1743
  const formatPhone = (digits) => {
    const value = String(digits || "").replace(/\D/g, "");
    if (value.length === 13 && value.indexOf("549") === 0) {
      return "+54 9 " + value.slice(3, 5) + " " + value.slice(5, 9) + "-" + value.slice(9);
    }
    return value ? "+" + value : "";
  };

  /* ---------- Categorías reales del catálogo ----------
     Se leen de window.CATEGORIES para que el menú no quede viejo.
     El link usa el id (?category=), que es lo que entiende tienda.html. */
  const fallbackCategories = [
    { id: "cocina", name: "Cocina" },
    { id: "mesa-vajilla", name: "Mesa y Vajilla" },
    { id: "organizacion", name: "Organización" },
    { id: "bano", name: "Baño" },
    { id: "textil-hogar", name: "Textil Hogar" },
    { id: "decoracion", name: "Decoración" },
    { id: "limpieza", name: "Limpieza" },
    { id: "electro-pequenos", name: "Electro Pequeños" },
    { id: "ofertas", name: "Ofertas", isVirtual: true }
  ];
  const categories = Array.isArray(window.CATEGORIES) && window.CATEGORIES.length
    ? window.CATEGORIES
    : fallbackCategories;

  const categoryItems = categories.map((category) => ({
    id: "cat-" + category.id,
    label: category.name,
    href: category.isVirtual
      ? "tienda.html?tag=oferta"
      : "tienda.html?category=" + encodeURIComponent(category.id)
  }));

  /* ---------- Mensajes de WhatsApp por tema ----------
     Cada acceso directo lleva un mensaje preparado para que el cliente
     no tenga que explicar de nuevo de qué hablaba. */
  const wa = {
    general: "Hola CIMA, escribo desde el asistente de la web. Quería hacer una consulta.",
    shipping: "Hola CIMA, tengo una consulta sobre envíos.",
    payment: "Hola CIMA, tengo una consulta sobre pagos y cuotas.",
    order: "Hola CIMA, quiero consultar por mi pedido.",
    returns: "Hola CIMA, quiero consultar por un cambio o una devolución.",
    stock: "Hola CIMA, quiero consultar la disponibilidad de un producto.",
    size: "Hola CIMA, necesito ayuda para elegir un producto."
  };

  /* ---------- Respuestas que se arman con datos reales ---------- */
  const paymentAnswer = [
    "Coordinamos el pago por WhatsApp al confirmar el pedido."
  ];
  if (transfer > 0) {
    paymentAnswer.push("Con transferencia bancaria tenés " + transfer + "% de descuento.");
  }
  if (installmentsText) {
    paymentAnswer.push(installmentsText + ".");
  }

  const shippingCostAnswer = [
    zones.length ? zoneText + "." : "El costo depende de la zona.",
    freeFrom > 0
      ? "El envío es gratis desde " + money(freeFrom) + "."
      : "Consultanos el costo según tu dirección."
  ];

  const pickupAnswer = [
    "El retiro es coordinado y sin costo.",
    "Acordamos el punto y el horario por WhatsApp cuando confirmás el pedido."
  ];
  if (!pickupEnabled) {
    pickupAnswer.length = 0;
    pickupAnswer.push("Por ahora no estamos ofreciendo retiro coordinado.", "Hacemos envíos a todo el país.");
  }

  const contactAnswer = [];
  if (whatsapp) contactAnswer.push("Por WhatsApp: " + formatPhone(whatsapp) + ".");
  if (clean(contact.email)) contactAnswer.push("Por email: " + clean(contact.email) + ".");
  if (clean(contact.instagram)) contactAnswer.push("En Instagram: @" + clean(contact.instagram) + ".");
  if (schedule) contactAnswer.push("Atendemos " + schedule.toLowerCase() + ".");
  if (!contactAnswer.length) contactAnswer.push("Consultanos por los canales de contacto de la tienda.");

  window.ALMATE_ASSISTANT_CONFIG = {
    /* Identificador del negocio: viaja en el DOM y en los eventos.
       El futuro ALMATE IA Comercial lo usa para reconocer la instalación. */
    version: "1.0.0",
    business: {
      id: "cima",
      name: clean(brand.name) || "CIMA",
      tagline: clean(brand.tagline) || "Bazar, hogar y cocina",
      sector: "bazar-hogar-cocina",
      whatsapp: whatsapp,
      email: clean(contact.email),
      instagram: clean(contact.instagram),
      schedule: schedule,
      address: clean(contact.address),
      currency: (store.currency && store.currency.code) || "ARS",
      locale: locale
    },

    credit: "Desarrollado por ALMATE · Soluciones digitales",

    /* ---------- Módulos ----------
       guidedMenus, keywordMatching, faq y whatsapp son la versión básica.
       Los demás quedan apagados por defecto y se activan cuando exista la
       implementación correspondiente. */
    modules: {
      guidedMenus: true,
      keywordMatching: true,
      faq: true,
      whatsapp: true,
      ai: false,
      catalog: false,
      priceLookup: false,
      stockLookup: false
    },

    /* ---------- Textos de la interfaz ---------- */
    ui: {
      title: "Asistente " + (clean(brand.name) || "CIMA"),
      subtitle: "Respuestas automáticas",
      launcherText: "¿Te ayudo?",
      openLabel: "Abrir asistente virtual",
      closeLabel: "Cerrar asistente",
      inputLabel: "Escribí tu consulta",
      placeholder: "Escribí tu consulta…",
      sendLabel: "Enviar consulta",
      menuLabel: "Elegí una opción",
      backLabel: "Volver al menú",
      whatsappLabel: "Escribir por WhatsApp",
      welcome: "¡Hola! Soy el asistente virtual de " + (clean(brand.name) || "CIMA") +
        ". Te puedo ayudar con envíos, pagos, tu pedido y productos. ¿Sobre qué querés consultar?",
      typing: "Buscando la respuesta…"
    },

    /* ---------- Menús guiados ----------
       Cada opción puede tener:
       - children: submenú
       - text: respuesta (string o lista de párrafos)
       - links: enlaces internos o externos
       - href: navegar directamente (categorías)
       - menuId: mostrar un submenú después de la respuesta
       - action: "whatsapp" para abrir el chat
       - whatsapp: true para mostrar el botón dentro de la respuesta */
    guidedMenus: [
      {
        id: "envios",
        label: "Envíos y entregas",
        text: "Hacemos envíos a todo el país y también podés coordinar el retiro sin costo.",
        children: [
          {
            id: "envio-costo",
            label: "¿Cuánto cuesta el envío?",
            text: shippingCostAnswer
          },
          {
            id: "envio-gratis",
            label: "Envío gratis",
            text: freeFrom > 0
              ? [
                  "El envío es gratis en compras desde " + money(freeFrom) + ".",
                  "Si tu compra no llega a ese monto, el costo depende de la zona y se calcula en el checkout."
                ]
              : ["Por ahora no tenemos envío gratis.", "El costo se calcula en el checkout según tu zona."]
          },
          {
            id: "envio-plazo",
            label: "¿Cuándo llega?",
            text: [
              "El plazo se confirma según tu zona, el producto y la disponibilidad.",
              "Lo coordinamos antes de cerrar el pedido para que sepas cuándo lo recibís."
            ],
            whatsapp: true,
            whatsappMessage: wa.shipping
          },
          {
            id: "retiro",
            label: pickupEnabled ? "Retiro coordinado" : "Formas de entrega",
            text: pickupAnswer
          },
          {
            id: "envio-cobertura",
            label: "¿A dónde envían?",
            text: [
              "Enviamos a todo el país: CABA y GBA, e interior.",
              "El costo y el plazo se confirman con tu dirección al coordinar el pedido."
            ]
          }
        ]
      },
      {
        id: "pagos",
        label: "Pagos y cuotas",
        text: "Te cuento cómo se coordina el pago.",
        children: [
          {
            id: "pago-medios",
            label: "¿Cómo puedo pagar?",
            text: paymentAnswer
          },
          {
            id: "cuotas",
            label: "Cuotas",
            text: installmentsText
              ? [
                  "Hoy ofrecemos " + installmentsText.toLowerCase() + ".",
                  "Consultanos por WhatsApp para confirmar las opciones vigentes al momento de comprar."
                ]
              : [
                  "Por ahora no tenemos cuotas activas.",
                  "Consultanos por WhatsApp y vemos qué opción podemos ofrecerte."
                ],
            whatsapp: true,
            whatsappMessage: wa.payment
          },
          {
            id: "transferencia",
            label: "Descuento por transferencia",
            text: transfer > 0
              ? [
                  "Con transferencia bancaria tenés " + transfer + "% de descuento.",
                  "El descuento se aplica al confirmar el pedido por WhatsApp."
                ]
              : ["Aceptamos transferencia bancaria.", "Coordinamos los datos al confirmar el pedido."]
          },
          {
            id: "pago-seguridad",
            label: "¿Es seguro comprar?",
            text: [
              "No compartas datos de tarjeta por WhatsApp.",
              "Hoy el pedido se coordina por WhatsApp y el pago por transferencia. Cuando activemos Mercado Pago, el pago se completa en su plataforma."
            ]
          }
        ]
      },
      {
        id: "pedido",
        label: "Mi pedido",
        children: [
          {
            id: "como-comprar",
            label: "¿Cómo compro?",
            text: [
              "1. Elegí los productos y agregalos al carrito.",
              "2. Completá tus datos y la forma de entrega en el checkout.",
              "3. Confirmá el pedido: se abre WhatsApp con el resumen.",
              "4. Te respondemos para coordinar el pago y la entrega."
            ],
            links: [
              { label: "Ver el catálogo", href: "tienda.html" },
              { label: "Ir al carrito", href: "carrito.html" }
            ]
          },
          {
            id: "estado-pedido",
            label: "Estado de mi pedido",
            text: [
              "Pasame el número de pedido por WhatsApp y te cuento en qué estado está.",
              "Si no lo tenés a mano, contanos qué compraste y cuándo."
            ],
            whatsapp: true,
            whatsappMessage: wa.order
          },
          {
            id: "cambios-devoluciones",
            label: "Cambios y devoluciones",
            text: [
              "Si recibiste un producto con un problema o querés un cambio, escribinos con el número de pedido, el producto y el motivo.",
              "Coordinamos los pasos según el caso."
            ],
            links: [
              { label: "Ver envíos y devoluciones", href: "envios-y-devoluciones.html" }
            ],
            whatsapp: true,
            whatsappMessage: wa.returns
          },
          {
            id: "arrepentimiento",
            label: "Botón de arrepentimiento",
            text: [
              "Podés iniciar el botón de arrepentimiento desde la web.",
              "Se abre WhatsApp con un mensaje preparado. Revisalo y enviálo: la solicitud no se registra sola."
            ],
            links: [
              { label: "Abrir botón de arrepentimiento", href: "arrepentimiento.html" }
            ]
          }
        ]
      },
      {
        id: "productos",
        label: "Productos y categorías",
        text: [
          "Tenemos cocina, mesa y vajilla, organización, baño, textil hogar, decoración, limpieza y electro pequeños.",
          "Elegí una categoría o mirá todo el catálogo."
        ],
        children: categoryItems.concat([
          { id: "cat-todo", label: "Ver todo el catálogo", href: "tienda.html" }
        ])
      },
      {
        id: "ayuda",
        label: "Cambios y devoluciones",
        text: [
          "Si recibiste un producto con un problema o querés un cambio, escribinos con el número de pedido, el producto y el motivo.",
          "También podés iniciar el botón de arrepentimiento desde la web."
        ],
        links: [
          { label: "Ver envíos y devoluciones", href: "envios-y-devoluciones.html" },
          { label: "Botón de arrepentimiento", href: "arrepentimiento.html" }
        ],
        whatsapp: true,
        whatsappMessage: wa.returns
      },
      {
        id: "humano",
        label: "Hablar por WhatsApp",
        text: "Te paso al WhatsApp de CIMA para que te responda una persona.",
        action: "whatsapp",
        whatsappMessage: wa.general
      },
      {
        id: "ver-faq",
        label: "Preguntas frecuentes",
        menuTitle: "Preguntas frecuentes",
        // La lista se arma con las preguntas de la sección faq.
        childrenFromFaq: [
          "envio-costo",
          "envio-plazo",
          "pago-medios",
          "cambios-devoluciones",
          "estado-pedido",
          "stock",
          "precio",
          "horario"
        ]
      }
    ],

    /* ---------- Preguntas frecuentes ----------
       Se usan para el reconocimiento de texto libre y para el menú de FAQ.
       Las keywords son términos canónicos (sin acentos) que se amplían con
       los sinónimos de abajo. */
    faq: [
      {
        id: "envio-general",
        question: "¿Hacen envíos?",
        keywords: ["envio"],
        answer: [
          "Hacemos envíos a todo el país y también podés coordinar el retiro sin costo.",
          "El costo depende de la zona: " + (zones.length ? zoneText + "." : "se confirma al coordinar el pedido.")
        ],
        menuId: "envios"
      },
      {
        id: "envio-costo",
        question: "¿Cuánto cuesta el envío?",
        keywords: ["envio", "precio"],
        answer: shippingCostAnswer,
        menuId: "envios"
      },
      {
        id: "envio-gratis",
        question: "¿Hay envío gratis?",
        keywords: ["envio", "gratis"],
        answer: freeFrom > 0
          ? [
              "El envío es gratis en compras desde " + money(freeFrom) + ".",
              "Si tu compra no llega a ese monto, el costo depende de la zona y se calcula en el checkout."
            ]
          : ["Por ahora no tenemos envío gratis.", "El costo se calcula en el checkout según tu zona."]
      },
      {
        id: "envio-plazo",
        question: "¿Cuánto tarda en llegar?",
        keywords: ["envio", "plazo"],
        answer: [
          "El plazo se confirma según tu zona, el producto y la disponibilidad.",
          "Lo coordinamos antes de cerrar el pedido."
        ],
        whatsapp: true,
        whatsappMessage: wa.shipping
      },
      {
        id: "retiro",
        question: "¿Puedo retirar?",
        keywords: ["retiro"],
        answer: pickupAnswer
      },
      {
        id: "pago-medios",
        question: "¿Cómo puedo pagar?",
        keywords: ["pago"],
        answer: paymentAnswer
      },
      {
        id: "cuotas",
        question: "¿Hay cuotas?",
        keywords: ["cuotas"],
        answer: installmentsText
          ? [
              "Hoy ofrecemos " + installmentsText.toLowerCase() + ".",
              "Consultanos por WhatsApp para confirmar las opciones vigentes al momento de comprar."
            ]
          : [
              "Por ahora no tenemos cuotas activas.",
              "Consultanos por WhatsApp y vemos qué opción podemos ofrecerte."
            ],
        whatsapp: true,
        whatsappMessage: wa.payment
      },
      {
        id: "transferencia",
        question: "¿Hay descuento por transferencia?",
        keywords: ["transferencia"],
        answer: transfer > 0
          ? [
              "Con transferencia bancaria tenés " + transfer + "% de descuento.",
              "El descuento se aplica al confirmar el pedido por WhatsApp."
            ]
          : ["Aceptamos transferencia bancaria.", "Coordinamos los datos al confirmar el pedido."]
      },
      {
        id: "pago-seguridad",
        question: "¿Es seguro comprar?",
        keywords: ["seguridad"],
        answer: [
          "No compartas datos de tarjeta por WhatsApp.",
          "Hoy el pedido se coordina por WhatsApp y el pago por transferencia. Cuando activemos Mercado Pago, el pago se completa en su plataforma."
        ]
      },
      {
        id: "como-comprar",
        question: "¿Cómo compro?",
        keywords: ["comprar"],
        answer: [
          "1. Elegí los productos y agregalos al carrito.",
          "2. Completá tus datos y la entrega en el checkout.",
          "3. Confirmá el pedido: se abre WhatsApp con el resumen.",
          "4. Te respondemos para coordinar el pago y la entrega."
        ],
        links: [
          { label: "Ver el catálogo", href: "tienda.html" },
          { label: "Ir al carrito", href: "carrito.html" }
        ]
      },
      {
        id: "estado-pedido",
        question: "¿Cómo sigo mi pedido?",
        keywords: ["pedido", "estado"],
        answer: [
          "Pasame el número de pedido por WhatsApp y te cuento en qué estado está.",
          "Si no lo tenés a mano, contanos qué compraste y cuándo."
        ],
        whatsapp: true,
        whatsappMessage: wa.order
      },
      {
        id: "pedido-general",
        question: "Consultas sobre mi pedido",
        keywords: ["pedido"],
        answer: [
          "Puedo ayudarte con cómo comprar, el estado de un pedido o un cambio.",
          "Si ya hiciste la compra, escribinos por WhatsApp con el número de pedido."
        ],
        menuId: "pedido",
        whatsapp: true,
        whatsappMessage: wa.order
      },
      {
        id: "cambios-devoluciones",
        question: "¿Hacen cambios o devoluciones?",
        keywords: ["cambio"],
        answer: [
          "Sí. Escribinos con el número de pedido, el producto y el motivo.",
          "Coordinamos los pasos según el caso y los derechos que te correspondan."
        ],
        links: [
          { label: "Ver envíos y devoluciones", href: "envios-y-devoluciones.html" }
        ],
        whatsapp: true,
        whatsappMessage: wa.returns
      },
      {
        id: "arrepentimiento",
        question: "¿Cómo ejerzo el botón de arrepentimiento?",
        keywords: ["arrepentimiento"],
        answer: [
          "Podés iniciar el botón de arrepentimiento desde la web.",
          "Se abre WhatsApp con un mensaje preparado. Revisalo y enviálo: la solicitud no se registra sola."
        ],
        links: [
          { label: "Abrir botón de arrepentimiento", href: "arrepentimiento.html" }
        ]
      },
      {
        id: "stock",
        question: "¿El producto que quiero está disponible?",
        keywords: ["stock"],
        answer: [
          "Cada producto muestra su disponibilidad en la ficha.",
          "Si está agotado, no se puede agregar al carrito. Escribinos si querés consultar por reposición."
        ],
        whatsapp: true,
        whatsappMessage: wa.stock
      },
      {
        id: "precio",
        question: "¿Los precios son finales?",
        keywords: ["precio"],
        answer: [
          "Los precios están en pesos argentinos y son los que figuran en cada producto.",
          "El total se arma en el carrito antes de confirmar el pedido."
        ]
      },
      {
        id: "productos",
        question: "¿Qué productos tienen?",
        keywords: ["producto"],
        answer: [
          "Tenemos cocina, mesa y vajilla, organización, baño, textil hogar, decoración, limpieza y electro pequeños.",
          "Mirá el catálogo completo o elegí una categoría."
        ],
        menuId: "productos"
      },
      {
        id: "ofertas",
        question: "¿Dónde están las ofertas?",
        keywords: ["oferta"],
        answer: [
          "Los productos con descuento están en la sección Ofertas.",
          "También los encontrás desde el menú de la tienda."
        ],
        links: [
          { label: "Ver ofertas", href: "tienda.html?tag=oferta" }
        ]
      },
      {
        id: "horario",
        question: "¿En qué horario atienden?",
        keywords: ["horario"],
        answer: schedule
          ? [
              "Atendemos " + schedule.toLowerCase() + ".",
              "Si escribís fuera de ese horario, te respondemos cuando volvamos a atender."
            ]
          : ["Consultanos el horario de atención por WhatsApp."],
        whatsapp: true,
        whatsappMessage: wa.general
      },
      {
        id: "ubicacion",
        question: "¿Dónde están ubicados?",
        keywords: ["ubicacion"],
        answer: [
          "No tenemos domicilio público.",
          "Coordinamos el retiro por WhatsApp y hacemos envíos a todo el país."
        ]
      },
      {
        id: "contacto",
        question: "¿Cómo los contacto?",
        keywords: ["contacto"],
        answer: contactAnswer,
        whatsapp: true,
        whatsappMessage: wa.general
      }
    ],

    /* ---------- Reconocimiento de texto ----------
       threshold: puntaje mínimo para responder. Cada keyword acertada suma 2
       (4 si es una frase completa). Por debajo del umbral se usa un fallback. */
    keywordMatching: {
      threshold: 2,
      synonyms: {
        envio: ["envio", "envios", "enviar", "envia", "envian", "mandan", "manda", "despacho", "correo", "llega", "llegan", "entrega", "entregas"],
        precio: ["precio", "precios", "sale", "salen", "cuesta", "cuestan", "valor", "valen"],
        pago: ["pago", "pagos", "pagar", "pagamos", "abono", "abonar", "tarjeta", "tarjetas", "debito", "credito", "efectivo", "mercadopago", "mp"],
        transferencia: ["transferencia", "transferencias", "transferir", "transfe"],
        cuotas: ["cuota", "cuotas", "financiacion", "financiar", "financiado", "interes", "intereses"],
        retiro: ["retiro", "retirar", "retira", "buscar", "busco", "paso", "pasamos"],
        plazo: ["plazo", "plazos", "tarda", "tardan", "demora", "demoran"],
        gratis: ["gratis", "gratuito", "gratuita", "gratuitos"],
        cambio: ["cambio", "cambios", "cambiar", "devolucion", "devoluciones", "devolver", "reintegro", "reembolso"],
        arrepentimiento: ["arrepentimiento", "arrepentir", "arrepiento"],
        pedido: ["pedido", "pedidos", "compra", "compre", "orden"],
        estado: ["estado", "sigue", "sigo", "seguimiento", "tracking"],
        stock: ["stock", "disponible", "disponibles", "agotado", "agotada", "reposicion", "reponer"],
        horario: ["horario", "horarios", "hora", "horas", "atienden", "abren", "cierran", "abierto"],
        ubicacion: ["ubicacion", "donde", "estan", "queda", "direccion", "local"],
        contacto: ["contacto", "contactar", "whatsapp", "wsp", "email", "mail", "instagram", "ig", "telefono", "llamar", "persona", "humano", "asesor", "vendedor"],
        producto: ["producto", "productos", "catalogo", "tienda", "articulo", "articulos"],
        comprar: ["comprar", "compra", "compro", "adquirir"],
        oferta: ["oferta", "ofertas", "descuento", "descuentos", "promo", "promocion"],
        seguridad: ["seguro", "segura", "seguridad", "confiable"]
      },
      // Respuestas alternativas cuando no se entiende la consulta.
      fallback: [
        "No estoy seguro de haber entendido. Podés elegir una opción del menú o escribirme con otras palabras.",
        "Esa no la tengo aprendida todavía. Probá con el menú de abajo o escribinos por WhatsApp y te responde una persona.",
        "No encontré una respuesta confiable para eso. Para no darte información incorrecta, mejor te paso con WhatsApp."
      ]
    },

    /* ---------- Acceso directo a WhatsApp ---------- */
    whatsapp: {
      number: whatsapp,
      defaultMessage: wa.general,
      messages: wa
    },

    /* ---------- Módulos avanzados (apagados) ----------
       Al activarlos, el motor delega en el handler registrado desde
       window.AlmateAssistant.registerModule(nombre, funcion).
       El diseño, la configuración y las FAQ se conservan. */
    ai: {
      enabled: false,
      provider: null,
      endpoint: "",
      model: "",
      systemPrompt: "",
      maxTokens: null
    },
    catalog: {
      enabled: false,
      source: "embedded",
      apiBaseUrl: ""
    },
    priceLookup: {
      enabled: false,
      currency: (store.currency && store.currency.code) || "ARS"
    },
    stockLookup: {
      enabled: false
    }
  };
})();
