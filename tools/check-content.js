/* ==========================================================================
   check-content.js — Revisión de contenido antes de publicar
   --------------------------------------------------------------------------
   Comando: node tools/check-content.js

   Revisa, sin instalar nada y sin conectarse a internet:
   - Que todas las imágenes referenciadas existan.
   - Cuántas fotos siguen siendo provisorias (.svg) y cuántas faltan.
   - Duplicados, ofertas mal cargadas y categorías inexistentes.
   - Que el sitio no apunte a localhost (rompería el catálogo publicado).
   - Dominio, datos legales y notas de plantilla en las páginas legales.

   Los [error] bloquean la publicación (sale con código 1).
   Los [pendiente] son decisiones del dueño y no bloquean.
   ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const resolve = (relative) => path.join(root, relative);
const exists = (relative) => fs.existsSync(resolve(relative));

const loadScript = (relative, name) => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(resolve(relative), "utf8"), context, { filename: relative });
  return context.window[name];
};

const products = loadScript("js/data/products.js", "PRODUCTS");
const categories = loadScript("js/data/categories.js", "CATEGORIES");
const config = loadScript("js/config.js", "STORE_CONFIG");

const findings = [];
const report = (level, message) => findings.push({ level, message });

/* ---------- Catálogo ---------- */

if (!Array.isArray(products) || !products.length) {
  report("error", "No hay productos cargados en js/data/products.js.");
}

const categoryIds = new Set(categories.map((category) => category.id));
const missingImages = [];
const placeholderProducts = products.filter((product) =>
  product.images.some((image) => image.endsWith(".svg"))
);
const singlePhoto = products.filter((product) => product.images.length < 2);
const unavailable = products.filter((product) => product.stock === 0);

for (const product of products) {
  for (const image of product.images) {
    if (!exists(image)) missingImages.push(product.slug + " → " + image);
  }
  if (!categoryIds.has(product.category)) {
    report("error", "El producto " + product.slug + " usa una categoría inexistente: " + product.category + ".");
  }
  if (product.comparePrice != null && product.comparePrice <= product.price) {
    report("error", "El precio anterior de " + product.slug + " no es mayor al precio actual.");
  }
}
if (missingImages.length) {
  report("error", "Hay " + missingImages.length + " imagen(es) referenciadas que no existen: " + missingImages.slice(0, 5).join("; ") + ".");
} else {
  report("ok", "Las " + products.reduce((total, product) => total + product.images.length, 0) + " imágenes referenciadas por los productos existen.");
}

const duplicates = (values) => values.filter((value, index) => values.indexOf(value) !== index);
if (duplicates(products.map((product) => product.slug)).length) {
  report("error", "Hay slugs de producto repetidos.");
}
if (duplicates(products.map((product) => product.sku)).length) {
  report("error", "Hay SKU repetidos.");
}

if (placeholderProducts.length) {
  report("pendiente", placeholderProducts.length + " de " + products.length + " productos usan una imagen provisoria (.svg). Reemplazalas por fotos reales.");
} else {
  report("ok", "Ningún producto usa imágenes provisorias.");
}
if (singlePhoto.length) {
  report("pendiente", singlePhoto.length + " productos tienen una sola foto. Se recomiendan 2 o 3 por producto.");
}
if (unavailable.length) {
  report("pendiente", unavailable.length + " producto(s) con stock 0: revisá si es a propósito (" + unavailable.map((product) => product.slug).join(", ") + ").");
}

/* ---------- Imágenes de categorías ---------- */

const missingCategoryImages = categories
  .filter((category) => category.image && !exists(category.image))
  .map((category) => category.id + " → " + category.image);
if (missingCategoryImages.length) {
  report("error", "Faltan imágenes de categoría: " + missingCategoryImages.join("; ") + ".");
} else {
  report("ok", "Las imágenes de las categorías visibles existen.");
}
const placeholderCategories = categories.filter((category) =>
  category.image && category.image.endsWith(".svg")
);
if (placeholderCategories.length) {
  report("pendiente", placeholderCategories.length + " categorías usan una imagen provisoria (.svg).");
}

/* ---------- Configuración del sitio ---------- */

const catalogUrl = String(config.catalog && config.catalog.apiBaseUrl || "");
if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(catalogUrl)) {
  report("error", "catalog.apiBaseUrl apunta a localhost (" + catalogUrl + "). En el sitio publicado la tienda aparecería vacía.");
} else if (catalogUrl) {
  report("ok", "El catálogo remoto apunta a " + catalogUrl + ".");
} else {
  report("ok", "El catálogo usa los archivos embebidos (modo estático de la Fase 1).");
}

const siteUrl = String(config.site && config.site.url || "");
if (!siteUrl || siteUrl.includes("TU-DOMINIO.example")) {
  report("pendiente", "Falta definir el dominio público en STORE_CONFIG.site.url (también en sitemap.xml y robots.txt).");
} else {
  report("ok", "Dominio configurado: " + siteUrl);
}

const legal = config.legal || {};
if (legal.businessName && legal.cuit) {
  report("ok", "Datos legales completos: " + legal.businessName + " — CUIT " + legal.cuit + ".");
} else {
  report("error", "Faltan la razón social o el CUIT en STORE_CONFIG.legal.");
}

const paymentProvider = String(config.payments && config.payments.provider || "whatsapp");
if (paymentProvider === "mercadopago") {
  report("pendiente", "El proveedor de pago está en Mercado Pago: requiere backend HTTPS y credenciales TEST configuradas.");
} else {
  report("ok", "Cobro inicial por WhatsApp/transferencia (no requiere backend para publicar).");
}

const installments = config.payments && config.payments.installments;
if (installments && installments.enabled && /sin inter/i.test(installments.text || "")) {
  report("pendiente", "Se anuncia \"" + installments.text + "\": confirmá con el titular que el comercio puede sostener ese costo.");
}
const shipping = config.shipping || {};
if (shipping.zones && shipping.zones.length) {
  report("pendiente", "Revisá los costos de envío (" + shipping.zones.map((zone) => zone.label + ": $" + zone.cost).join(", ") + ") y el envío gratis desde $" + shipping.freeShippingFrom + ".");
}

/* ---------- Páginas legales ---------- */

const legalPages = [
  "terminos.html",
  "privacidad.html",
  "arrepentimiento.html",
  "envios-y-devoluciones.html"
];
const draftPages = legalPages.filter((page) =>
  exists(page) && fs.readFileSync(resolve(page), "utf8").includes("legal-template-note")
);
if (draftPages.length) {
  report("pendiente", draftPages.length + " páginas legales siguen marcadas como borrador para revisión profesional: " + draftPages.join(", ") + ".");
} else {
  report("ok", "Las páginas legales no tienen la nota de borrador.");
}

/* ---------- Salida ---------- */

const groups = {
  error: findings.filter((finding) => finding.level === "error"),
  pendiente: findings.filter((finding) => finding.level === "pendiente"),
  ok: findings.filter((finding) => finding.level === "ok")
};
const symbols = { error: "[error]    ", pendiente: "[pendiente]", ok: "[ok]       " };

console.log("CIMA — Revisión de contenido para publicar\n");
for (const level of ["ok", "pendiente", "error"]) {
  for (const finding of groups[level]) {
    console.log(symbols[level] + " " + finding.message);
  }
}

console.log("");
console.log(groups.error.length + " error(es), " + groups.pendiente.length + " pendiente(s), " + groups.ok.length + " control(es) correctos.");
if (groups.error.length) {
  console.log("Corregí los [error] antes de publicar. Guía: CONTENIDO-PARA-PUBLICAR.md");
  process.exitCode = 1;
} else {
  console.log("No hay errores técnicos. Los [pendiente] los decide el dueño. Guía: CONTENIDO-PARA-PUBLICAR.md");
}
