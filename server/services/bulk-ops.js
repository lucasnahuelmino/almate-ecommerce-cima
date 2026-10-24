/* ==========================================================================
   bulk-ops.js — Operaciones masivas de catálogo (Etapa 3)
   --------------------------------------------------------------------------
   Reglas clave:
   • Vista previa y aplicación calculan TODO en el servidor: el navegador solo
     manda alcance (selección o categoría) y operación, nunca los valores
     finales de cada producto.
   • La vista previa NO escribe nada en la base.
   • La aplicación corre en UNA transacción: o se aplican todos los cambios
     calculados o no se aplica ninguno.
   • Solo se modifica el campo elegido (precio, publicación, destacados o
     stock). Imágenes, descripciones, variantes y el resto no se tocan.
   • El stock se maneja como góndola (data.stock − vendido) y nunca baja de
     las reservas activas: se muestra como fila bloqueada con el motivo.
   ========================================================================== */

const {
  getProductForAdmin,
  listCatalogProductsAdminPaged,
  listCategories,
  patchProductData,
  setCatalogProductActive
} = require("../db");

/** Error con código HTTP listo para el middleware de errores. */
const httpError = (status, message) => Object.assign(new Error(message), { status });

const MAX_SCOPE_PRODUCTS = 1000;
const PRICE_LIMIT = 100000000; // máximo de precio permitido por el catálogo
const STOCK_LIMIT = 10000000; // máximo de stock permitido por el catálogo

/** Pasos de redondeo de precio (múltiplo resultante). */
const ROUNDING_STEPS = { exact: 1, to10: 10, to100: 100 };

/** Formatea números con coma decimal (es-AR) para los mensajes. */
const formatNumber = (value) => String(value).replace(".", ",");

/* ---------- Normalización de la entrada (con validación) ---------- */

const normalizeOperation = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "La operación no tiene un formato válido.");
  }
  const readNumber = (raw, label, { min, max, integer = false }) => {
    const value = Number(raw);
    if (raw === undefined || raw === null || raw === "" || !Number.isFinite(value)) {
      throw httpError(400, `Completá ${label}.`);
    }
    if (integer && !Number.isSafeInteger(value)) {
      throw httpError(400, `${label} debe ser un número entero.`);
    }
    if (value < min || value > max) {
      throw httpError(400, `${label} debe estar entre ${formatNumber(min)} y ${formatNumber(max)}.`);
    }
    return value;
  };

  const kind = String(input.kind || "");

  if (kind === "price") {
    const mode = String(input.mode || "");
    const direction = String(input.direction || "");
    if (!["percent", "amount"].includes(mode)) {
      throw httpError(400, "Elegí si el cambio de precio es por porcentaje o por importe.");
    }
    if (!["up", "down"].includes(direction)) {
      throw httpError(400, "Elegí si el precio sube o baja.");
    }
    const value = mode === "percent"
      ? readNumber(input.value, "el porcentaje", { min: 0.01, max: 1000 })
      : readNumber(input.value, "el importe", { min: 1, max: PRICE_LIMIT, integer: true });
    const rounding = input.rounding === undefined || input.rounding === ""
      ? "exact"
      : String(input.rounding);
    if (!Object.hasOwn(ROUNDING_STEPS, rounding)) {
      throw httpError(400, "El redondeo elegido no existe.");
    }
    return { kind, mode, direction, value, rounding };
  }

  if (kind === "active" || kind === "featured") {
    if (typeof input.value !== "boolean") {
      throw httpError(400, 'Elegí "Sí" o "No" para el cambio de estado.');
    }
    return { kind, value: input.value };
  }

  if (kind === "stock") {
    const mode = String(input.mode || "");
    if (!["increase", "decrease", "set"].includes(mode)) {
      throw httpError(400, "Elegí si el stock suma, resta o se pone en un valor.");
    }
    const value = readNumber(input.value, "las unidades", {
      min: mode === "set" ? 0 : 1,
      max: STOCK_LIMIT,
      integer: true
    });
    return { kind, mode, value };
  }

  throw httpError(400, "Elegí una operación válida: precios, publicación, destacados o stock.");
};

const normalizeScope = (scope) => {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    throw httpError(400, "Elegí qué productos modificar: la selección de la lista o una categoría.");
  }
  const type = String(scope.type || "");
  if (type === "ids") {
    const ids = Array.isArray(scope.ids)
      ? scope.ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    if (!ids.length) {
      throw httpError(400, "No hay productos seleccionados: marcá al menos uno en la lista.");
    }
    if (ids.length > MAX_SCOPE_PRODUCTS) {
      throw httpError(400, `Se pueden modificar hasta ${MAX_SCOPE_PRODUCTS} productos por vez.`);
    }
    ids.forEach((id) => {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
        throw httpError(400, "La selección contiene un identificador no válido.");
      }
    });
    return { type, ids: [...new Set(ids)] };
  }
  if (type === "category") {
    const category = String(scope.category || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(category)) {
      throw httpError(400, "Elegí una categoría válida.");
    }
    return { type, category };
  }
  throw httpError(400, "El alcance solo puede ser por selección o por categoría.");
};

/** Carga los productos actuales del alcance (con sold/reserved al día). */
const resolveScopeProducts = (database, scope, now) => {
  if (scope.type === "ids") {
    const products = scope.ids.map((id) => getProductForAdmin(database, id, now));
    const missing = scope.ids.filter((_, index) => !products[index]);
    if (missing.length) {
      throw httpError(409, "Algunos productos seleccionados ya no existen; recargá la lista e intentá de nuevo.");
    }
    return products;
  }
  const exists = listCategories(database).some((category) => category.id === scope.category);
  if (!exists) throw httpError(400, `La categoría "${scope.category}" no existe.`);
  const result = listCatalogProductsAdminPaged(
    database,
    { category: scope.category, limit: MAX_SCOPE_PRODUCTS, offset: 0 },
    now
  );
  if (result.total > MAX_SCOPE_PRODUCTS) {
    throw httpError(400, `La categoría tiene más de ${MAX_SCOPE_PRODUCTS} productos: usá la selección de la lista para dividir el cambio en partes.`);
  }
  if (!result.products.length) {
    throw httpError(400, `La categoría "${scope.category}" no tiene productos.`);
  }
  return result.products;
};

/* ---------- Cálculo por producto ---------- */

const baseRow = (product, current) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  current,
  next: null,
  status: "blocked",
  reason: "",
  note: ""
});

const roundPrice = (raw, step) => Math.round(raw / step) * step;

const priceRow = (product, operation) => {
  const current = product.price;
  const row = baseRow(product, current);
  let raw;
  if (operation.mode === "percent") {
    const factor = operation.direction === "up"
      ? 1 + operation.value / 100
      : 1 - operation.value / 100;
    raw = current * factor;
  } else {
    raw = current + (operation.direction === "up" ? operation.value : -operation.value);
  }
  const rounded = roundPrice(raw, ROUNDING_STEPS[operation.rounding]);
  if (rounded < 1) {
    row.reason = "El precio resultante sería $1 o menos.";
    return row;
  }
  if (rounded > PRICE_LIMIT) {
    row.reason = `El precio superaría el máximo de $${PRICE_LIMIT.toLocaleString("es-AR")}.`;
    return row;
  }
  row.next = rounded;
  if (rounded === current) {
    row.status = "noop";
    row.reason = "Sin cambios: el precio ya es ese valor.";
    return row;
  }
  row.status = "change";
  // Aviso informativo si cambia la etiqueta de oferta (precio tachado).
  const compare = product.comparePrice;
  if (compare != null && compare > 0) {
    const wasOffer = current < compare;
    const willOffer = rounded < compare;
    if (wasOffer !== willOffer) {
      row.note = willOffer
        ? "Empezará a mostrarse con precio tachado (Oferta)."
        : "Dejará de mostrarse con precio tachado (Oferta).";
    }
  }
  return row;
};

const stockRow = (product, operation) => {
  const current = product.stock; // góndola = data.stock − vendido
  const reserved = product.reserved;
  const row = baseRow(product, current);
  let next;
  if (operation.mode === "set") next = operation.value;
  else if (operation.mode === "increase") next = current + operation.value;
  else next = current - operation.value;

  if (next < 0) {
    row.reason = `No alcanza el stock actual (${current}) para restar ${operation.value} unidad(es).`;
    return row;
  }
  if (next < reserved) {
    row.reason = `Quedaría por debajo de las ${reserved} unidad(es) reservada(s) activamente.`;
    return row;
  }
  if (next > STOCK_LIMIT) {
    row.reason = `Superaría el máximo de ${STOCK_LIMIT.toLocaleString("es-AR")} unidades.`;
    return row;
  }
  row.next = next;
  if (next === current) {
    row.status = "noop";
    row.reason = "Sin cambios: el stock ya es ese valor.";
    return row;
  }
  row.status = "change";
  return row;
};

const stateRow = (product, operation) => {
  const current = operation.kind === "active" ? product.active : product.featured;
  const row = baseRow(product, current);
  row.next = operation.value;
  if (current === operation.value) {
    row.status = "noop";
    row.reason = "Sin cambios: ya tiene ese estado.";
    return row;
  }
  row.status = "change";
  return row;
};

const computeRow = (product, operation) => {
  if (operation.kind === "price") return priceRow(product, operation);
  if (operation.kind === "stock") return stockRow(product, operation);
  return stateRow(product, operation);
};

/* ---------- Descripción y resumen ---------- */

const describeOperation = (operation) => {
  if (operation.kind === "price") {
    const amount = operation.mode === "percent"
      ? `${formatNumber(operation.value)} %`
      : `$ ${operation.value.toLocaleString("es-AR")}`;
    const verb = operation.direction === "up" ? "Subir precios" : "Bajar precios";
    const rounding = operation.rounding === "exact"
      ? "entero exacto"
      : operation.rounding === "to10"
        ? "múltiplo de 10"
        : "múltiplo de 100";
    return `${verb} ${amount} (redondeo: ${rounding})`;
  }
  if (operation.kind === "active") return operation.value ? "Publicar productos" : "Ocultar productos";
  if (operation.kind === "featured") {
    return operation.value ? "Marcar como destacados" : "Quitar de destacados";
  }
  const verb = { increase: "Sumar", decrease: "Restar", set: "Poner el stock en" }[operation.mode];
  return `${verb} ${operation.value} unidad(es) de stock`;
};

const summarize = (rows) => ({
  total: rows.length,
  changes: rows.filter((row) => row.status === "change").length,
  noops: rows.filter((row) => row.status === "noop").length,
  blocked: rows.filter((row) => row.status === "blocked").length
});

const buildResult = (scope, operation, products) => {
  const rows = products.map((product) => computeRow(product, operation));
  return {
    field: operation.kind,
    description: describeOperation(operation),
    scope: scope.type === "ids" ? { type: "ids", count: scope.ids.length } : { type: "category", category: scope.category },
    summary: summarize(rows),
    rows
  };
};

/* ---------- API pública ---------- */

/** Vista previa: calcula todo sin escribir nada en la base. */
const previewBulkOperation = (database, input, now = new Date().toISOString()) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "La operación masiva no tiene un formato válido.");
  }
  const scope = normalizeScope(input.scope);
  const operation = normalizeOperation(input.operation);
  const products = resolveScopeProducts(database, scope, now);
  return buildResult(scope, operation, products);
};

/**
 * Aplica la operación en una sola transacción.
 * Recalcula con los datos ACTUALES (no confía en la vista previa enviada
 * por el navegador): si los datos cambiaron entre vista previa y aplicación,
 * se aplican los valores recién calculados.
 */
const applyBulkOperation = (database, input, now = new Date().toISOString()) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "La operación masiva no tiene un formato válido.");
  }
  const scope = normalizeScope(input.scope);
  const operation = normalizeOperation(input.operation);
  const products = resolveScopeProducts(database, scope, now);
  const result = buildResult(scope, operation, products);

  // Guardamos el vendido por producto para convertir góndola → total físico.
  const soldById = new Map(products.map((product) => [product.id, product.sold]));

  const applied = database.transaction(() => {
    let count = 0;
    for (const row of result.rows) {
      if (row.status !== "change") continue;
      if (operation.kind === "active") {
        setCatalogProductActive(database, row.id, row.next);
      } else {
        const changes = operation.kind === "price"
          ? { price: row.next }
          : operation.kind === "featured"
            ? { featured: row.next }
            // data.stock = valor de góndola + vendido (semántica del catálogo)
            : { stock: row.next + (soldById.get(row.id) || 0) };
        patchProductData(database, row.id, changes);
      }
      count += 1;
    }
    return count;
  })();

  result.summary.applied = applied;
  return result;
};

module.exports = {
  applyBulkOperation,
  previewBulkOperation
};
