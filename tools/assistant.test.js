/* ==========================================================================
   assistant.test.js — Pruebas del motor del Asistente ALMATE
   --------------------------------------------------------------------------
   Comando: node --test tools/assistant.test.js

   Prueba la función resolve() (reconocimiento de consultas) con la
   configuración real de CIMA. No usa navegador ni red: el motor se carga en
   Node y solo se ejercita la lógica pura.
   ========================================================================== */

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

// El sitio está escrito para el navegador: window es el objeto global.
globalThis.window = globalThis;

const root = path.resolve(__dirname, "..");
require(path.join(root, "js", "config.js"));
require(path.join(root, "js", "data", "categories.js"));
require(path.join(root, "js", "data", "products.js"));
require(path.join(root, "almate-assistant.config.js"));
require(path.join(root, "almate-assistant.js"));

const assistant = globalThis.AlmateAssistant;
const config = globalThis.ALMATE_ASSISTANT_CONFIG;

test("el motor se registra una sola vez y expone la API pública", () => {
  assert.ok(assistant, "No se creó window.AlmateAssistant.");
  assert.strictEqual(typeof assistant.resolve, "function");
  assert.strictEqual(typeof assistant.open, "function");
  assert.strictEqual(typeof assistant.registerModule, "function");
  assert.strictEqual(typeof assistant.setAIHandler, "function");
});

test("los módulos avanzados están apagados por defecto", () => {
  assert.strictEqual(config.modules.ai, false);
  assert.strictEqual(config.modules.catalog, false);
  assert.strictEqual(config.modules.priceLookup, false);
  assert.strictEqual(config.modules.stockLookup, false);
});

test("el crédito es exacto", () => {
  assert.strictEqual(config.credit, "Desarrollado por ALMATE · Soluciones digitales");
});

const cases = [
  // [consulta, id esperado]
  ["¿Cuánto cuesta el envío?", "envio-costo"],
  ["cuanto sale el envio al interior", "envio-costo"],
  ["hacen envíos a Mendoza", "envio-general"],
  ["¿Hay envío gratis?", "envio-gratis"],
  ["cuánto tarda en llegar", "envio-plazo"],
  ["tengo demoras con la entrega", "envio-plazo"],
  ["puedo retirar por el local", "retiro"],
  ["¿Puedo pagar con tarjeta?", "pago-medios"],
  ["se puede pagar con mercadopago", "pago-medios"],
  ["hay cuotas sin interés", "cuotas"],
  ["descuento por transferencia", "transferencia"],
  ["¿Es seguro comprar?", "pago-seguridad"],
  ["cómo compro", "como-comprar"],
  ["cómo sigo mi pedido", "estado-pedido"],
  ["consultas sobre mi pedido", "pedido-general"],
  ["quiero devolver un producto", "cambios-devoluciones"],
  ["cambios y devoluciones", "cambios-devoluciones"],
  ["botón de arrepentimiento", "arrepentimiento"],
  ["stock disponible", "stock"],
  ["el producto está agotado", "stock"],
  ["precio del producto", "precio"],
  ["qué productos tienen", "productos"],
  ["dónde están las ofertas", "ofertas"],
  ["horario de atención", "horario"],
  ["dónde están ubicados", "ubicacion"],
  ["tienen local", "ubicacion"],
  ["cómo los contacto", "contacto"],
  ["quiero hablar con una persona", "contacto"]
];

cases.forEach(([text, expected]) => {
  test('"' + text + '" → ' + expected, () => {
    const result = assistant.resolve(text);
    assert.ok(result, "No se reconoció la consulta: " + text);
    assert.strictEqual(result.id, expected, "Se esperaba " + expected + " y se obtuvo " + result.id);
  });
});

test("las consultas sin relación usan la respuesta alternativa", () => {
  ["hola", "buenas tardes", "asdfgh", ""].forEach((text) => {
    assert.strictEqual(assistant.resolve(text), null, "No debería responder FAQ a: " + text);
  });
});

test("no distingue mayúsculas, acentos ni signos", () => {
  assert.strictEqual(assistant.resolve("ENVÍO GRATIS!!").id, "envio-gratis");
  assert.strictEqual(assistant.resolve("  ¿Cuánto   tarda? ").id, "envio-plazo");
});

test("el menú de FAQ apunta a preguntas reales", () => {
  const faqIds = new Set(config.faq.map((entry) => entry.id));
  const menu = config.guidedMenus.find((item) => item.id === "ver-faq");
  assert.ok(menu, "Falta el menú de preguntas frecuentes.");
  menu.childrenFromFaq.forEach((id) => {
    assert.ok(faqIds.has(id), "El menú de FAQ referencia un id inexistente: " + id);
  });
});

test("las categorías del menú existen en el catálogo", () => {
  const ids = new Set(globalThis.CATEGORIES.map((category) => category.id));
  const productos = config.guidedMenus.find((item) => item.id === "productos");
  assert.ok(productos, "Falta el menú de productos.");
  const categorias = productos.children.filter((item) => item.href && item.href.indexOf("category=") !== -1);
  assert.ok(categorias.length >= 5, "El menú de productos no lista las categorías.");
  categorias.forEach((item) => {
    const id = decodeURIComponent(item.href.split("category=")[1]);
    assert.ok(ids.has(id), "Categoría inexistente en el menú: " + id);
  });
});
