/* ==========================================================================
   order-filters.test.js — Pruebas de filtros y CSV del panel de pedidos
   --------------------------------------------------------------------------
   Cubren normalización de búsqueda, validación de filtros, límites de fecha
   en hora argentina y protección del CSV contra fórmulas de Excel.
   ========================================================================== */

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CSV_HEADERS,
  buildOrdersCsv,
  formatCsvDate,
  normalizeText,
  parseOrderFilters,
  sanitizeCsvCell,
  toLikePattern
} = require("../services/order-filters");

test("normaliza búsquedas sin acentos, mayúsculas ni espacios de más", () => {
  assert.equal(normalizeText("  PÉREZ   Ana "), "perez ana");
  assert.equal(normalizeText("Muñoz"), "munoz");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeText(undefined), "");
});

test("escapa los comodines de LIKE para que sean literales", () => {
  assert.equal(toLikePattern("100%_real"), "%100\\%\\_real%");
  assert.equal(toLikePattern("C\\asa"), "%c\\\\asa%");
});

test("sin parámetros no aplica ningún filtro", () => {
  assert.deepEqual(parseOrderFilters({}), {
    status: null,
    fulfillment: null,
    q: null,
    fromIso: null,
    toIso: null
  });
});

test("acepta filtros válidos y recorta la búsqueda", () => {
  const filters = parseOrderFilters({
    status: "PAID",
    fulfillment: "preparing",
    q: "  Ana  ",
    from: "2026-10-01",
    to: "2026-10-31"
  });
  assert.equal(filters.status, "paid");
  assert.equal(filters.fulfillment, "preparing");
  assert.equal(filters.q, "Ana");
  assert.equal(filters.fromIso, "2026-10-01T03:00:00.000Z");
  // El día "hasta" se incluye completo: el límite es el inicio del día siguiente.
  assert.equal(filters.toIso, "2026-11-01T03:00:00.000Z");
});

test("un estado desconocido devuelve error 400", () => {
  assert.throws(() => parseOrderFilters({ status: "cobrado" }), (error) => error.status === 400);
  assert.throws(() => parseOrderFilters({ fulfillment: "enviado" }), (error) => error.status === 400);
  assert.throws(() => parseOrderFilters({ from: "31/10/2026" }), (error) => error.status === 400);
  assert.throws(() => parseOrderFilters({ to: "2026-02-30" }), (error) => error.status === 400);
  assert.throws(
    () => parseOrderFilters({ from: "2026-10-31", to: "2026-10-01" }),
    (error) => error.status === 400
  );
  assert.throws(() => parseOrderFilters({ q: "x".repeat(81) }), (error) => error.status === 400);
});

test("convierte la fecha a hora argentina", () => {
  assert.equal(formatCsvDate("2026-10-31T14:05:00.000Z"), "31/10/2026 11:05");
  assert.equal(formatCsvDate(""), "");
  assert.equal(formatCsvDate("no-es-fecha"), "");
});

test("antepone apóstrofo a celdas que Excel interpretaría como fórmula", () => {
  assert.equal(sanitizeCsvCell("=SUM(1)"), "'=SUM(1)");
  assert.equal(sanitizeCsvCell("+54 9 11"), "'+54 9 11");
  assert.equal(sanitizeCsvCell("-3"), "'-3");
  assert.equal(sanitizeCsvCell("@user"), "'@user");
  // Los textos normales no se tocan.
  assert.equal(sanitizeCsvCell("Ana Gómez"), "Ana Gómez");
  assert.equal(sanitizeCsvCell(null), "");
});

test("genera el CSV con encabezados, ítems y total numérico", () => {
  const order = {
    orderId: "11111111-2222-4333-8444-555555555555",
    createdAt: "2026-10-31T14:05:00.000Z",
    paymentStatus: "paid",
    fulfillmentStatus: "preparing",
    total: 31400,
    items: [
      { name: "Set de ollas", qty: 2, variants: [{ label: "Color", value: "Negro" }] },
      { name: "Tabla de madera", qty: 1, variants: [] }
    ],
    customer: {
      name: "Ana Gómez",
      email: "ana@example.com",
      phone: "5491123456789"
    },
    shipping: {
      method: "delivery",
      label: "CABA y GBA",
      address: "Calle Falsa 123",
      city: "Buenos Aires",
      province: "CABA",
      postalCode: "1425",
      notes: 'Timbre "B", dejar en portería'
    }
  };

  const csv = buildOrdersCsv([order]);
  const [header, row] = csv.split("\r\n");

  assert.equal(header, CSV_HEADERS.join(","));
  assert.match(row, /31\/10\/2026 11:05/);
  assert.match(row, /Pagado/);
  assert.match(row, /Preparando/);
  assert.match(row, /Ana Gómez/);
  assert.match(row, /2 × Set de ollas \(Color: Negro\); 1 × Tabla de madera/);
  // Las comillas internas se escapan duplicándolas.
  assert.match(row, /"Timbre ""B"", dejar en portería"/);
  assert.match(row, /,31400$/);
  // El CSV del panel no incluye DNI ni datos que no hacen falta para preparar el envío.
  assert.equal(csv.includes("30123456"), false);
});

test("protege nombres y notas con fórmulas en el CSV completo", () => {
  const csv = buildOrdersCsv([{
    orderId: "11111111-2222-4333-8444-555555555555",
    createdAt: "2026-10-31T14:05:00.000Z",
    paymentStatus: "pending",
    fulfillmentStatus: "awaiting_confirmation",
    total: 100,
    items: [{ name: "=HYPERLINK(1)", qty: 1, variants: [] }],
    customer: { name: "=SUM(1)", email: "@malicioso", phone: "+54" },
    shipping: { method: "pickup", label: "Retiro coordinado", notes: "-2+3" }
  }]);
  assert.match(csv, /'=SUM\(1\)/);
  assert.match(csv, /'@malicioso/);
  assert.match(csv, /'\+54/);
  assert.match(csv, /'-2\+3/);
  // El nombre del producto viaja después del "1 × ", así que no inicia la celda
  // y Excel no lo evalúa como fórmula.
  assert.match(csv, /,1 × =HYPERLINK\(1\),/);
});
