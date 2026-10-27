/* ==========================================================================
   audit.js — Auditoría y reversión de acciones del panel (Etapa 5)
   --------------------------------------------------------------------------
   Registra toda acción administrativa relevante en la tabla
   admin_audit_log: crear, editar (con campo y valores anterior/nuevo),
   duplicar, archivar, borrar, masivas, importaciones, imágenes, respaldos
   y reversiones.
   • El registro NUNCA rompe la operación principal: si falla, se avisa por
     consola y la operación continúa (el registro es espejo, no transacción).
   • Cada entrada lleva un resumen legible (es-AR) para el panel y, en
     precio/stock, el detalle necesario para poder REVERTIR la acción.
   • La reversión es todo-o-nada: valida todo antes de escribir y aplica en
     UNA transacción. Solo revierte precio y stock (lo que el registro
     guardó): el resto de los campos no se toca.
   ========================================================================== */

const { getProductForAdmin, patchProductData } = require("../db");

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Acciones que el panel puede revertir (solo si guardaron precio/stock). */
const REVERTIBLE_ACTIONS = new Set(["product.update", "catalog.bulk", "audit.revert"]);
const REVERTIBLE_FIELDS = new Set(["price", "stock"]);

const FIELD_LABELS = {
  name: "Nombre",
  sku: "SKU",
  slug: "Enlace",
  category: "Categoría",
  subcategory: "Subcategoría",
  price: "Precio",
  comparePrice: "Precio anterior",
  stock: "Stock",
  images: "Imágenes",
  shortDescription: "Descripción corta",
  description: "Descripción",
  specs: "Especificaciones",
  variants: "Variantes",
  tags: "Etiquetas",
  featured: "Destacado",
  active: "Publicado"
};

const ACTION_LABELS = {
  "product.create": "Producto creado",
  "product.update": "Producto editado",
  "product.duplicate": "Producto duplicado",
  "product.archive": "Publicación cambiada",
  "product.delete": "Producto borrado",
  "catalog.import": "Importación CSV",
  "catalog.import.enhanced": "Importación de archivo",
  "catalog.bulk": "Cambio masivo",
  "media.upload": "Imagen cargada",
  "media.delete": "Imagen borrada",
  "backup.create": "Respaldo de la base",
  "audit.revert": "Acción revertida"
};

const BACKUP_REASONS = {
  "catalog-import": "antes de importar el CSV",
  "catalog-import-enhanced": "antes de importar el archivo",
  "catalog-bulk": "antes del cambio masivo"
};

/* ---------- Formato legible ---------- */

const formatMoney = (value) =>
  `$ ${Math.round(Number(value)).toLocaleString("es-AR")}`;

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "vacío";
  if (field === "price" || field === "comparePrice") return formatMoney(value);
  if (field === "stock") return `${value} u.`;
  if (field === "active" || field === "featured") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.length ? `${value.length} elemento(s)` : "vacío";
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

const describeChanges = (changes) => {
  if (!changes.length) return "sin cambios";
  const parts = changes.slice(0, 4).map((change) =>
    `${FIELD_LABELS[change.field] || change.field}: ${formatValue(change.field, change.before)} → ${formatValue(change.field, change.after)}`);
  if (changes.length > 4) parts.push(`+${changes.length - 4} más`);
  return parts.join(" · ");
};

/** Resumen de UNA entrada, en español rioplatense. */
const describeAuditEntry = ({ action, result, detail }) => {
  let text = "";
  switch (action) {
    case "product.create":
      text = `Se creó "${detail.name || ""}" (${detail.sku || ""}) a ${formatMoney(detail.price || 0)}`;
      break;
    case "product.update":
      text = `"${detail.name || ""}": ${describeChanges(detail.changes || [])}`;
      break;
    case "product.duplicate":
      text = `Se duplicó "${detail.name || ""}" como "${detail.copyName || ""}"`;
      break;
    case "product.archive":
      text = `Se ${detail.active ? "publicó" : "ocultó"} "${detail.name || ""}"`;
      break;
    case "product.delete":
      text = `Se borró "${detail.name || ""}" (${detail.sku || ""}) a ${formatMoney(detail.price || 0)}`;
      break;
    case "catalog.import": {
      text = `CSV técnico: ${detail.added || 0} creado(s), ${detail.updated || 0} actualizado(s)`;
      if (detail.backup) text += ` · respaldo previo: ${detail.backup}`;
      break;
    }
    case "catalog.import.enhanced": {
      const applied = detail.applied || {};
      const summary = detail.summary || {};
      text = `Archivo: ${applied.created || 0} creado(s), ${applied.updated || 0} actualizado(s)` +
        (summary.error ? ` · ${summary.error} fila(s) con error` : "");
      if (detail.backup) text += ` · respaldo previo: ${detail.backup}`;
      break;
    }
    case "catalog.bulk": {
      const summary = detail.summary || {};
      text = `${detail.description || "Cambio masivo"} · ${summary.changes || 0} modificado(s)` +
        (summary.noops ? ` · ${summary.noops} sin cambios` : "") +
        (summary.blocked ? ` · ${summary.blocked} bloqueado(s)` : "");
      if (detail.backup) text += ` · respaldo previo: ${detail.backup}`;
      break;
    }
    case "media.upload":
      text = `Imagen cargada: ${detail.name || ""}`;
      break;
    case "media.delete":
      text = `Imagen borrada: ${detail.name || ""}`;
      break;
    case "backup.create":
      text = `Respaldo ${BACKUP_REASONS[detail.reason] || ""}: ${detail.file || ""} (${Math.round((detail.bytes || 0) / 1024)} KB)`;
      break;
    case "audit.revert":
      text = `Se revirtió la acción #${detail.from || "?"}: ${describeChanges(detail.changes || [])}`;
      break;
    default:
      text = detail.error || "";
  }
  if (result === "error") {
    text = `${text ? `${text} — ` : ""}Falló: ${detail.error || "error desconocido"}`;
  }
  return text;
};

/** true si la entrada puede revertirse desde el panel. */
const isRevertible = ({ action, result, detail }) =>
  result === "ok" &&
  REVERTIBLE_ACTIONS.has(action) &&
  Array.isArray(detail.revertChanges) &&
  detail.revertChanges.length > 0 &&
  detail.revertChanges.every((change) => REVERTIBLE_FIELDS.has(change.field));

/* ---------- Persistencia (nunca rompe la operación principal) ---------- */

const recordAdminAudit = (database, {
  action,
  entity = "",
  entityId = "",
  detail = {},
  result = "ok",
  now = new Date().toISOString()
}) => {
  try {
    const info = database.prepare(
      `INSERT INTO admin_audit_log (created_at, action, entity, entity_id, result, detail)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      now,
      action,
      entity,
      String(entityId || ""),
      result === "error" ? "error" : "ok",
      JSON.stringify(detail || {})
    );
    return Number(info.lastInsertRowid);
  } catch (error) {
    console.error(`[audit] No se pudo registrar "${action}": ${error.message}`);
    return null;
  }
};

const parseDetail = (raw) => {
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
};

/** Fila → entrada del panel (con resumen y bandera de reversión). */
const hydrate = (row, includeDetail) => {
  const detail = parseDetail(row.detail);
  const base = { action: row.action, result: row.result, detail };
  const entry = {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    label: ACTION_LABELS[row.action] || row.action,
    entity: row.entity,
    entityId: row.entity_id,
    result: row.result,
    summary: describeAuditEntry(base),
    revertible: isRevertible(base)
  };
  if (includeDetail) entry.detail = detail;
  return entry;
};

const getAdminAuditRow = (database, id) =>
  database.prepare("SELECT * FROM admin_audit_log WHERE id = ?").get(id);

/** Paginación del historial (orden: lo más reciente primero). */
const listAdminAudit = (database, query = {}) => {
  const parse = (value, name, { min, max, fallback }) => {
    if (value === undefined || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw httpError(400, `El parámetro "${name}" debe ser un entero entre ${min} y ${max}.`);
    }
    return parsed;
  };
  const limit = parse(query.limit, "limit", { min: 1, max: 100, fallback: 25 });
  const offset = parse(query.offset, "offset", { min: 0, max: 1000000, fallback: 0 });
  const rows = database.prepare(
    "SELECT * FROM admin_audit_log ORDER BY id DESC LIMIT ? OFFSET ?"
  ).all(limit, offset);
  const { total } = database.prepare("SELECT COUNT(*) AS total FROM admin_audit_log").get();
  return { total, entries: rows.map((row) => hydrate(row, false)) };
};

/* ---------- Reversión (todo-o-nada) ---------- */

/**
 * Revierte los cambios de precio/stock guardados en una entrada.
 * • Valida TODO primero (sin escribir): productos existentes, precios y
 *   stock dentro de los límites y stock nunca por debajo de reservas.
 * • Aplica todo en UNA transacción y registra la reversión como una acción
 *   nueva (que a su vez es reversible).
 */
const revertAdminAudit = (database, id, now = new Date().toISOString()) => {
  const row = getAdminAuditRow(database, id);
  if (!row) throw httpError(404, "Registro de historial no encontrado.");
  const entry = hydrate(row, true);
  if (!entry.revertible) {
    throw httpError(409, "Esta acción no tiene cambios de precio o stock para revertir.");
  }
  const changes = entry.detail.revertChanges;

  // 1. Validación completa SIN escribir.
  const plan = changes.map((change) => {
    const product = getProductForAdmin(database, change.productId, now);
    if (!product) {
      throw httpError(409, `No se puede revertir: el producto "${change.name || change.productId}" ya no existe.`);
    }
    if (!REVERTIBLE_FIELDS.has(change.field)) {
      throw httpError(409, "Solo se pueden revertir cambios de precio o stock.");
    }
    if (change.field === "price") {
      const price = Number(change.before);
      if (!Number.isSafeInteger(price) || price < 1 || price > 100000000) {
        throw httpError(409, `No se puede revertir: el precio guardado de "${product.name}" no es válido.`);
      }
      return { change, product, patch: { price } };
    }
    const gondola = Number(change.before);
    if (!Number.isSafeInteger(gondola) || gondola < 0 || gondola > 10000000) {
      throw httpError(409, `No se puede revertir: el stock guardado de "${product.name}" no es válido.`);
    }
    const total = gondola + product.sold;
    if (total < product.reserved) {
      throw httpError(409,
        `No se puede revertir: dejaría a "${product.name}" con ${gondola} unidad(es) por debajo de las ${product.reserved} reservadas activamente.`);
    }
    return { change, product, patch: { stock: total } };
  });

  // 2. Aplicación en UNA transacción + registro de la reversión.
  const applied = database.transaction(() => {
    const appliedChanges = plan.map(({ change, product, patch }) => {
      patchProductData(database, change.productId, patch);
      const before = change.field === "price" ? product.price : product.stock;
      const after = change.field === "price" ? patch.price : Number(change.before);
      return {
        productId: change.productId,
        name: product.name,
        sku: product.sku,
        field: change.field,
        before,
        after
      };
    });
    recordAdminAudit(database, {
      action: "audit.revert",
      entity: "product",
      entityId: String(entry.id),
      detail: {
        from: entry.id,
        changes: appliedChanges,
        // Mismo par before/after: revertir la reversión vuelve al valor previo.
        revertChanges: appliedChanges
      },
      result: "ok",
      now
    });
    return appliedChanges;
  })();

  return { reverted: applied.length, changes: applied };
};

module.exports = {
  REVERTIBLE_ACTIONS,
  describeAuditEntry,
  listAdminAudit,
  recordAdminAudit,
  revertAdminAudit
};
