/* ==========================================================================
   check-assistant.js — Verificación del Asistente ALMATE antes de publicar
   --------------------------------------------------------------------------
   Comando: node tools/check-assistant.js

   Revisa, sin instalar nada y sin conectarse a internet:
   - Que existan los tres archivos del componente y no estén vacíos.
   - Que la configuración sea coherente (ids únicos, menús, FAQ, enlaces,
     categorías reales, módulos avanzados apagados y crédito exacto).
   - Que el asistente esté integrado UNA sola vez en las 12 páginas públicas,
     con el orden correcto de scripts y sin meterse en la página de estilos
     ni en el panel del servidor.
   - Que el motor no haga conexiones externas (solo WhatsApp por enlace).

   Los [error] bloquean la publicación (sale con código 1).
   ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const resolve = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(resolve(relative), "utf8");

const findings = [];
const report = (level, message) => findings.push({ level: level, message: message });

/* ---------- 1. Archivos obligatorios ---------- */

const FILES = ["almate-assistant.js", "almate-assistant.css", "almate-assistant.config.js"];

FILES.forEach((file) => {
  if (!fs.existsSync(resolve(file))) {
    report("error", "Falta el archivo obligatorio " + file + ".");
    return;
  }
  if (read(file).trim().length < 200) {
    report("error", "El archivo " + file + " parece vacío o incompleto.");
  }
});

if (fs.existsSync(resolve("almate-assistant.css"))) {
  const css = read("almate-assistant.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  if (open !== close) {
    report("error", "almate-assistant.css tiene llaves desbalanceadas (" + open + " abiertas, " + close + " cerradas).");
  }
  if (/@import\b/i.test(css)) {
    report("error", "almate-assistant.css no debe importar otras hojas de estilo.");
  }
  if (/url\(\s*['"]?https?:/i.test(css)) {
    report("error", "almate-assistant.css carga un recurso externo.");
  }
  if (css.indexOf(".almate") === -1) {
    report("error", "almate-assistant.css debe estar aislado bajo la clase .almate.");
  }
}

if (findings.some((item) => item.level === "error")) {
  printAndExit();
}

/* ---------- 2. Cargar la configuración real del proyecto ---------- */

const sandbox = { window: {} };
const run = (relative) => vm.runInNewContext(read(relative), sandbox, { filename: relative });

run("js/config.js");
run("js/data/categories.js");
run("js/data/products.js");
run("almate-assistant.config.js");

const config = sandbox.window.ALMATE_ASSISTANT_CONFIG;
const categories = sandbox.window.CATEGORIES || [];
const store = sandbox.window.STORE_CONFIG || {};

if (!config || !config.business) {
  report("error", "almate-assistant.config.js no expone window.ALMATE_ASSISTANT_CONFIG.");
  printAndExit();
}

/* ---------- 3. Identidad y crédito ---------- */

if (!config.business.id) report("error", "La configuración no tiene business.id.");
if (!config.business.name) report("error", "La configuración no tiene business.name.");
if (config.credit !== "Desarrollado por ALMATE · Soluciones digitales") {
  report("error", "El crédito debe ser exactamente: Desarrollado por ALMATE · Soluciones digitales");
}
if (!config.ui || !config.ui.welcome) {
  report("error", "Falta el mensaje de bienvenida en ui.welcome.");
} else {
  if (!/asistente virtual/i.test(config.ui.welcome)) {
    report("error", "La bienvenida debe aclarar que es un asistente virtual.");
  }
}
if (config.ui && !/autom[aá]tic/i.test(config.ui.subtitle || "")) {
  report("warning", "El subtítulo no aclara que las respuestas son automáticas.");
}

/* ---------- 4. Módulos: básicos activos, avanzados apagados ---------- */

const modules = config.modules || {};
["guidedMenus", "keywordMatching", "faq", "whatsapp"].forEach((name) => {
  if (modules[name] !== true) report("error", "El módulo básico '" + name + "' debe estar activo.");
});
["ai", "catalog", "priceLookup", "stockLookup"].forEach((name) => {
  if (modules[name] !== false) report("error", "El módulo avanzado '" + name + "' debe estar apagado por defecto.");
});
["ai", "catalog", "priceLookup", "stockLookup"].forEach((name) => {
  const section = config[name];
  if (!section || typeof section !== "object") {
    report("error", "Falta la sección de configuración '" + name + "'.");
  } else if (section.enabled === true) {
    report("error", "La sección '" + name + "' no debe estar habilitada todavía.");
  }
});

/* ---------- 5. Menús guiados ---------- */

const menuNodes = [];
const menuIds = new Set();

const walkMenus = (items) => {
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== "object") {
      report("error", "Hay una opción de menú inválida.");
      return;
    }
    if (!item.id) {
      report("error", "Hay una opción de menú sin id.");
      return;
    }
    if (menuIds.has(item.id)) report("error", "Id de menú duplicado: " + item.id + ".");
    menuIds.add(item.id);
    menuNodes.push(item);
    if (!item.label) report("error", "La opción de menú '" + item.id + "' no tiene label.");
    if (Array.isArray(item.children)) walkMenus(item.children);
  });
};

walkMenus(config.guidedMenus);

if (menuNodes.length < 5) report("error", "El asistente necesita al menos 5 opciones de menú.");

/* ---------- 6. Preguntas frecuentes ---------- */

const faq = Array.isArray(config.faq) ? config.faq : [];
const faqIds = new Set();

if (faq.length < 10) report("error", "Se esperaban al menos 10 preguntas frecuentes.");

faq.forEach((entry) => {
  if (!entry || !entry.id) {
    report("error", "Hay una pregunta frecuente sin id.");
    return;
  }
  if (faqIds.has(entry.id)) report("error", "Id de FAQ duplicado: " + entry.id + ".");
  faqIds.add(entry.id);
  if (!entry.question || !entry.answer) {
    report("error", "La FAQ '" + entry.id + "' necesita question y answer.");
    return;
  }
  if (!Array.isArray(entry.keywords) || !entry.keywords.length) {
    report("error", "La FAQ '" + entry.id + "' no tiene keywords.");
  }
  if (entry.menuId && !menuIds.has(entry.menuId)) {
    report("error", "La FAQ '" + entry.id + "' apunta a un menú inexistente: " + entry.menuId + ".");
  }
  (Array.isArray(entry.links) ? entry.links : []).forEach((link) => {
    if (!link || !link.label || !link.href) {
      report("error", "La FAQ '" + entry.id + "' tiene un enlace incompleto.");
      return;
    }
    if (/^https?:/i.test(link.href) && !/^https:\/\/wa\.me\//i.test(link.href)) {
      report("error", "La FAQ '" + entry.id + "' apunta a un sitio externo: " + link.href + ".");
    }
  });
});

/* ---------- 7. Cruces entre menús, FAQ y categorías ---------- */

menuNodes.forEach((item) => {
  if (Array.isArray(item.childrenFromFaq)) {
    item.childrenFromFaq.forEach((id) => {
      if (!faqIds.has(id)) {
        report("error", "El menú '" + item.id + "' lista una FAQ inexistente: " + id + ".");
      }
    });
  }
  (Array.isArray(item.links) ? item.links : []).forEach((link) => {
    if (!link || !link.label || !link.href) {
      report("error", "El menú '" + item.id + "' tiene un enlace incompleto.");
    }
  });
  if (item.action === "whatsapp" && !config.whatsapp.number) {
    report("error", "El menú '" + item.id + "' pide WhatsApp pero no hay número configurado.");
  }
});

const categoryIds = new Set(categories.map((category) => category.id));
menuNodes.forEach((item) => {
  if (typeof item.href !== "string") return;
  if (item.href.indexOf("tienda.html?category=") === 0) {
    const id = decodeURIComponent(item.href.split("=")[1] || "");
    if (!categoryIds.has(id)) {
      report("error", "El menú '" + item.id + "' usa una categoría inexistente: " + id + ".");
    }
  } else if (item.href.indexOf("tienda.html?") === 0) {
    const tag = item.href.split("tag=")[1] || "";
    if (tag && !["oferta", "nuevo"].includes(tag)) {
      report("error", "El menú '" + item.id + "' usa una etiqueta desconocida: " + tag + ".");
    }
  }
});

faq.forEach((entry) => {
  (Array.isArray(entry.links) ? entry.links : []).forEach((link) => {
    if (!link || typeof link.href !== "string") return;
    if (link.href.indexOf("tienda.html?category=") === 0) {
      const id = decodeURIComponent(link.href.split("=")[1] || "");
      if (!categoryIds.has(id)) {
        report("error", "La FAQ '" + entry.id + "' usa una categoría inexistente: " + id + ".");
      }
    }
  });
});

if (categories.length < 5) report("warning", "Se detectaron pocas categorías para el menú de productos.");

/* ---------- 8. WhatsApp con datos reales de la tienda ---------- */

const storeNumber = String((store.contact && store.contact.whatsapp) || "").replace(/\D/g, "");
const assistantNumber = String((config.whatsapp && config.whatsapp.number) || "").replace(/\D/g, "");

if (!assistantNumber) {
  report("error", "El asistente no tiene número de WhatsApp configurado.");
} else if (storeNumber && assistantNumber !== storeNumber) {
  report("error", "El WhatsApp del asistente no coincide con STORE_CONFIG.contact.whatsapp.");
}

/* ---------- 9. Respuestas alternativas y sinónimos ---------- */

const matching = config.keywordMatching || {};
if (!Array.isArray(matching.fallback) || matching.fallback.length < 2) {
  report("error", "Debe haber al menos 2 respuestas alternativas (keywordMatching.fallback).");
}
if (!matching.synonyms || !Object.keys(matching.synonyms).length) {
  report("error", "Faltan los sinónimos de keywordMatching.");
} else {
  Object.keys(matching.synonyms).forEach((canonical) => {
    const list = matching.synonyms[canonical];
    if (!Array.isArray(list) || !list.length) {
      report("error", "El grupo de sinónimos '" + canonical + "' está vacío.");
      return;
    }
    if (new Set(list).size !== list.length) {
      report("error", "El grupo de sinónimos '" + canonical + "' tiene palabras repetidas.");
    }
  });
}

// Toda FAQ que dependa del reconocimiento debe tener al menos una palabra
// clave mapeada en los sinónimos (o coincidir con su nombre canónico).
const canonicalTerms = new Set(Object.keys(matching.synonyms || {}));
faq.forEach((entry) => {
  const terms = Array.isArray(entry.keywords) ? entry.keywords : [];
  const mapped = terms.some((term) => canonicalTerms.has(term));
  if (!mapped) {
    report("warning", "La FAQ '" + entry.id + "' usa palabras clave que no están en los sinónimos.");
  }
});

/* ---------- 10. Integración en las páginas ---------- */

const PAGES = [
  "index.html",
  "tienda.html",
  "producto.html",
  "carrito.html",
  "checkout.html",
  "gracias.html",
  "contacto.html",
  "envios-y-devoluciones.html",
  "terminos.html",
  "privacidad.html",
  "arrepentimiento.html",
  "404.html"
];

const count = (text, needle) => text.split(needle).length - 1;

PAGES.forEach((page) => {
  if (!fs.existsSync(resolve(page))) {
    report("error", "No existe la página " + page + ".");
    return;
  }
  const html = read(page);
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    report("error", page + " no tiene </head>.");
    return;
  }
  const head = html.slice(0, headEnd);

  const cssCount = count(head, 'href="almate-assistant.css"');
  const configCount = count(head, 'src="almate-assistant.config.js"');
  const engineCount = count(head, 'src="almate-assistant.js"');

  if (cssCount !== 1) report("error", page + " debe cargar almate-assistant.css exactamente una vez (tiene " + cssCount + ").");
  if (configCount !== 1) report("error", page + " debe cargar almate-assistant.config.js exactamente una vez (tiene " + configCount + ").");
  if (engineCount !== 1) report("error", page + " debe cargar almate-assistant.js exactamente una vez (tiene " + engineCount + ").");

  const configPos = head.indexOf('src="almate-assistant.config.js"');
  const enginePos = head.indexOf('src="almate-assistant.js"');
  if (configPos !== -1 && enginePos !== -1 && configPos > enginePos) {
    report("error", page + " carga el motor antes que su configuración.");
  }

  const storePos = head.indexOf('src="js/config.js"');
  if (storePos === -1) {
    report("error", page + " no carga js/config.js; el asistente no tendría datos reales.");
  } else if (configPos !== -1 && storePos > configPos) {
    report("error", page + " carga la configuración del asistente antes que js/config.js.");
  }
});

["estilos.html", "server/admin/index.html"].forEach((page) => {
  if (!fs.existsSync(resolve(page))) return;
  if (read(page).indexOf("almate-assistant") !== -1) {
    report("error", page + " no debe incluir el asistente (no carga los datos de la tienda).");
  }
});

/* ---------- 11. Motor sin dependencias ni conexiones externas ---------- */

const engine = read("almate-assistant.js");

if (engine.indexOf(ROOT_GUARD()) === -1) {
  report("error", "El motor no tiene la guarda anti-duplicado por id.");
}
["fetch(", "XMLHttpRequest", "importScripts", "localStorage"].forEach((forbidden) => {
  if (engine.indexOf(forbidden) !== -1) {
    report("error", "El motor no debe usar '" + forbidden + "': la versión básica no necesita red ni almacenamiento.");
  }
});
if (engine.indexOf("https://") !== -1 && engine.indexOf("https://wa.me/") === -1) {
  report("error", "El motor hace una conexión externa que no es WhatsApp.");
}
["registerModule", "setAIHandler"].forEach((hook) => {
  if (engine.indexOf(hook) === -1) report("error", "Falta el gancho de ampliación '" + hook + "'.");
});

function ROOT_GUARD() {
  return "getElementById(ROOT_ID)";
}

/* ---------- 12. Salida ---------- */

function printAndExit() {
  const errors = findings.filter((item) => item.level === "error");
  const warnings = findings.filter((item) => item.level === "warning");

  if (!findings.length) {
    console.log("[ok] Asistente ALMATE: configuración e integración correctas.");
  }
  findings.forEach((item) => {
    console.log("[" + item.level + "] " + item.message);
  });

  console.log("");
  console.log("Menús: " + menuNodes.length + " opciones · FAQ: " + faq.length + " · Categorías: " + categories.length);
  console.log("Errores: " + errors.length + " · Avisos: " + warnings.length);

  process.exit(errors.length ? 1 : 0);
}

printAndExit();
