/* ==========================================================================
   order-filters.js — Filtros y exportación CSV del panel de pedidos
   --------------------------------------------------------------------------
   Funciones puras (sin acceso a disco ni a la base) para:
   - Normalizar texto de búsqueda (sin acentos y sin distinguir mayúsculas).
   - Validar y convertir los filtros que llegan por la URL.
   - Generar el CSV de pedidos con protección contra fórmulas de Excel.

   Se separan del router para poder probarlas sin levantar el servidor.
   ========================================================================== */

const PAYMENT_STATUSES = ["pending", "paid", "failed"];
const FULFILLMENT_STATUSES = [
  "awaiting_confirmation",
  "preparing",
  "dispatched",
  "delivered"
];
const MAX_SEARCH_LENGTH = 80;
// Argentina no aplica horario de verano: el desfase es siempre -03:00.
const AR_OFFSET = "-03:00";
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const paymentLabels = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido"
};

const fulfillmentLabels = {
  awaiting_confirmation: "Pendiente de preparación",
  preparing: "Preparando",
  dispatched: "Despachado",
  delivered: "Entregado"
};

/* ---------- Texto ---------- */

// Quita acentos, pasa a minúsculas y compacta espacios. "PÉREZ  Ana" → "perez ana".
const normalizeText = (value) => String(value == null ? "" : value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

// Escapa los comodines de LIKE para que una búsqueda con % o _ sea literal.
const escapeLikePattern = (value) => value.replace(/[\\%_]/g, "\\$&");

const toLikePattern = (value) => "%" + escapeLikePattern(normalizeText(value)) + "%";

/* ---------- Validación de filtros ---------- */

const filterError = (message) => Object.assign(new Error(message), { status: 400 });

const firstValue = (value) => Array.isArray(value) ? value[0] : value;

const readText = (value) => String(firstValue(value) == null ? "" : firstValue(value)).trim();

const isValidDate = (value) => {
  // El constructor de Date "corrige" fechas imposibles (30 de febrero). Se
  // compara la fecha resultante para rechazarlas en lugar de aceptarlas.
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseDate = (value, label) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValidDate(value)) {
    throw filterError(label + " debe ser una fecha válida con formato AAAA-MM-DD.");
  }
  return new Date(value + "T00:00:00" + AR_OFFSET).getTime();
};

/**
 * Convierte el query string del panel en filtros validados.
 * Devuelve { status, fulfillment, q, fromIso, toIso } o lanza un error 400.
 */
const parseOrderFilters = (query = {}) => {
  const status = readText(query.status).toLowerCase();
  if (status && !PAYMENT_STATUSES.includes(status)) {
    throw filterError("El estado del pago no es válido.");
  }

  const fulfillment = readText(query.fulfillment).toLowerCase();
  if (fulfillment && !FULFILLMENT_STATUSES.includes(fulfillment)) {
    throw filterError("El estado de preparación no es válido.");
  }

  const q = readText(query.q);
  if (q.length > MAX_SEARCH_LENGTH) {
    throw filterError("La búsqueda no puede superar los " + MAX_SEARCH_LENGTH + " caracteres.");
  }

  const from = readText(query.from);
  const to = readText(query.to);
  let fromIso = null;
  let toIso = null;
  if (from && to && from > to) {
    throw filterError("La fecha desde no puede ser posterior a la fecha hasta.");
  }
  if (from) fromIso = new Date(parseDate(from, "La fecha desde")).toISOString();
  if (to) {
    // Se incluye el día completo: el límite superior es el inicio del día siguiente.
    toIso = new Date(parseDate(to, "La fecha hasta") + DAY_MS).toISOString();
  }

  return {
    status: status || null,
    fulfillment: fulfillment || null,
    q: q || null,
    fromIso,
    toIso
  };
};

/* ---------- CSV ---------- */

const escapeCsv = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

// Evita que un nombre como "=SUM(1)" se ejecute como fórmula al abrir el CSV
// en Excel o Google Sheets. Se antepone un apóstrofo, que la planilla no muestra.
const sanitizeCsvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
};

const csvCell = (value) => escapeCsv(sanitizeCsvCell(value));

const csvDateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

// Convierte un ISO de la base en "31/10/2026 14:05" (hora de Argentina).
const formatCsvDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = csvDateFormatter.formatToParts(date)
    .reduce((accumulator, part) => {
      if (part.type !== "literal") accumulator[part.type] = part.value;
      return accumulator;
    }, {});
  return [parts.day, parts.month, parts.year].join("/") + " " +
    [parts.hour, parts.minute].join(":");
};

const itemsToText = (items = []) => items.map((item) => {
  const variants = Array.isArray(item.variants) && item.variants.length
    ? " (" + item.variants.map((variant) => variant.label + ": " + variant.value).join(", ") + ")"
    : "";
  return item.qty + " × " + item.name + variants;
}).join("; ");

const CSV_HEADERS = [
  "Pedido",
  "Fecha",
  "Estado del pago",
  "Preparación",
  "Cliente",
  "Email",
  "Teléfono",
  "Entrega",
  "Dirección",
  "Ciudad",
  "Provincia",
  "Código postal",
  "Notas",
  "Ítems",
  "Total (ARS)"
];

// Un pedido del panel → una fila del CSV, en el mismo orden que CSV_HEADERS.
const orderToCsvRow = (order) => [
  order.orderId,
  formatCsvDate(order.createdAt),
  paymentLabels[order.paymentStatus] || order.paymentStatus,
  fulfillmentLabels[order.fulfillmentStatus] || order.fulfillmentStatus,
  order.customer && order.customer.name,
  order.customer && order.customer.email,
  order.customer && order.customer.phone,
  order.shipping && (order.shipping.label || order.shipping.method),
  order.shipping && order.shipping.address,
  order.shipping && order.shipping.city,
  order.shipping && order.shipping.province,
  order.shipping && order.shipping.postalCode,
  order.shipping && order.shipping.notes,
  itemsToText(order.items),
  order.total
];

const buildOrdersCsv = (orders = []) => [
  CSV_HEADERS.join(","),
  ...orders.map((order) => orderToCsvRow(order).map(csvCell).join(","))
].join("\r\n");

module.exports = {
  PAYMENT_STATUSES,
  FULFILLMENT_STATUSES,
  MAX_SEARCH_LENGTH,
  CSV_HEADERS,
  normalizeText,
  toLikePattern,
  parseOrderFilters,
  buildOrdersCsv,
  formatCsvDate,
  sanitizeCsvCell
};
