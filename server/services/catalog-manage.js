/* ==========================================================================
   catalog-manage.js — Gestión individual de productos (panel de administración)
   --------------------------------------------------------------------------
   Valida y normaliza la carga de UN producto desde el formulario visual.
   Reglas clave:
   • El formulario envía "stock" = unidades de góndola (físico − vendido).
     Al guardar se persiste data.stock = stockRecibido + vendido.
   • Nunca se permite bajar el stock por debajo de las reservas activas.
   • Reutiliza las reglas de product-rules.js (mismas que la importación CSV).
   ========================================================================== */

const {
  categoryExists,
  catalogProductConflicts,
  deleteProductForAdmin,
  getProductForAdmin,
  listCatalogProductsAdminPaged,
  nextProductSortOrder,
  setCatalogProductActive,
  upsertProductRow
} = require("../db");
const {
  validateProductLists,
  validateProductTexts
} = require("./product-rules");
const { recordAdminAudit } = require("./audit");

/** Error con código HTTP listo para el middleware de errores. */
const httpError = (status, message) => Object.assign(new Error(message), { status });

const slugify = (value) => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

/** Parsea los parámetros de la URL del listado con validación. */
const parseListFilters = (query = {}) => {
  const parseBool = (value, name) => {
    if (value === undefined || value === "") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    throw httpError(400, `El filtro "${name}" solo admite true o false.`);
  };
  const parseInt = (value, name, { min, max, fallback }) => {
    if (value === undefined || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw httpError(400, `El parámetro "${name}" debe ser un entero entre ${min} y ${max}.`);
    }
    return parsed;
  };
  const sortWhitelist = ["name", "price", "stock", "createdAt", "sortOrder"];
  const sort = query.sort && String(query.sort);
  if (sort && !sortWhitelist.includes(sort)) {
    throw httpError(400, "El orden pedido no está disponible.");
  }
  const stockFilter = query.stock ? String(query.stock) : "";
  if (stockFilter && !["in", "out"].includes(stockFilter)) {
    throw httpError(400, 'El filtro de stock solo admite "in" o "out".');
  }
  const minPrice = query.minPrice !== undefined && query.minPrice !== ""
    ? parseInt(query.minPrice, "minPrice", { min: 0, max: 100000000, fallback: null })
    : null;
  const maxPrice = query.maxPrice !== undefined && query.maxPrice !== ""
    ? parseInt(query.maxPrice, "maxPrice", { min: 0, max: 100000000, fallback: null })
    : null;
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw httpError(400, "El precio mínimo no puede superar el máximo.");
  }
  return {
    search: query.q ? String(query.q).slice(0, 120) : "",
    category: query.category ? String(query.category).slice(0, 80) : "",
    active: parseBool(query.active, "active"),
    featured: parseBool(query.featured, "featured"),
    stockFilter,
    minPrice,
    maxPrice,
    sort: sort || "sortOrder",
    order: query.order === "desc" ? "desc" : "asc",
    limit: parseInt(query.limit, "limit", { min: 1, max: 100, fallback: 25 }),
    offset: parseInt(query.offset, "offset", { min: 0, max: 100000, fallback: 0 })
  };
};

/**
 * Normaliza el cuerpo del formulario a un producto completo.
 * `existing` (si se pasa) aporta los valores que el formulario no envía.
 * `sold` es la cantidad ya vendida del producto (para convertir stock).
 */
const normalizeProductInput = (body, { existing = null, sold = 0 } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "Los datos del producto no tienen un formato válido.");
  }
  const pick = (key, fallback) => (body[key] === undefined || body[key] === null || body[key] === ""
    ? fallback
    : body[key]);

  const name = String(pick("name", existing ? existing.name : "")).trim();
  const sku = String(pick("sku", existing ? existing.sku : "")).trim();
  const slugInput = String(pick("slug", existing ? existing.slug : "")).trim();
  const slug = slugInput || slugify(name);

  if (!name || name.length > 180) {
    throw httpError(400, "Completá el nombre del producto (máx. 180 caracteres).");
  }
  if (!sku || !/^[a-zA-Z0-9_-]{1,80}$/.test(sku)) {
    throw httpError(400, "El SKU solo puede tener letras, números, guiones y guiones bajos (máx. 80 caracteres).");
  }
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) {
    throw httpError(400, "El enlace (slug) solo puede tener letras minúsculas, números y guiones.");
  }
  const category = String(pick("category", existing ? existing.category : "")).trim();
  if (!category || !/^[a-zA-Z0-9_-]+$/.test(category)) {
    throw httpError(400, "Elegí una categoría válida.");
  }

  const priceRaw = pick("price", existing ? existing.price : null);
  const price = Number(priceRaw);
  if (!Number.isSafeInteger(price) || price <= 0 || price > 100000000) {
    throw httpError(400, "El precio debe ser un número entero mayor a cero.");
  }
  const compareRaw = pick("comparePrice", existing ? existing.comparePrice : null);
  let comparePrice = null;
  if (compareRaw !== null && compareRaw !== "") {
    comparePrice = Number(compareRaw);
    if (!Number.isSafeInteger(comparePrice) || comparePrice < 0 || comparePrice > 100000000) {
      throw httpError(400, "El precio anterior debe ser un entero mayor o igual a cero, o quedar vacío.");
    }
  }

  const stockRaw = pick("stock", existing ? existing.stock : 0);
  const stockOnHand = Number(stockRaw);
  if (!Number.isSafeInteger(stockOnHand) || stockOnHand < 0 || stockOnHand > 10000000) {
    throw httpError(400, "El stock debe ser un número entero mayor o igual a cero.");
  }
  const reserved = existing ? existing.reserved : 0;
  if (stockOnHand < reserved) {
    throw httpError(409, `El stock no puede bajar de ${reserved} unidades: hay reservas activas de ese producto.`);
  }

  const list = (key, fallback) => {
    const value = pick(key, fallback);
    if (!Array.isArray(value)) {
      throw httpError(400, `El campo "${key}" debe ser una lista.`);
    }
    return value;
  };
  const product = {
    id: existing ? existing.id : `p_${slugify(sku)}`,
    name,
    sku,
    slug,
    category,
    subcategory: String(pick("subcategory", existing ? existing.subcategory : "")).slice(0, 80),
    price,
    comparePrice,
    stock: stockOnHand + sold,
    images: list("images", existing ? existing.images : []).map((image) => String(image).trim()).filter(Boolean),
    shortDescription: String(pick("shortDescription", existing ? existing.shortDescription : "")).slice(0, 500),
    description: String(pick("description", existing ? existing.description : "")),
    specs: list("specs", existing ? existing.specs : []),
    variants: list("variants", existing ? existing.variants : []),
    tags: list("tags", existing ? existing.tags : []).map((tag) => String(tag).trim()).filter(Boolean),
    featured: pick("featured", existing ? existing.featured : false) === true,
    active: pick("active", existing ? existing.active : true) === true,
    createdAt: pick("createdAt", existing ? existing.createdAt : new Date().toISOString().slice(0, 10))
  };
  return product;
};

/** Valida un producto completo con las mismas reglas que la importación CSV. */
const validateForSave = (database, product, { excludeId = "" } = {}) => {
  const conflicts = catalogProductConflicts(database, {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    excludeId
  });
  // El id se genera desde el SKU, así que un SKU repetido produce también un
  // id repetido: avisamos primero por el SKU, que es lo que ve quien carga.
  if (conflicts.skuTaken) throw httpError(409, "Ya existe un producto con ese SKU.");
  if (conflicts.slugTaken) throw httpError(409, "Ya existe un producto con ese enlace (slug).");
  if (conflicts.idTaken) throw httpError(409, "Ya existe un producto con ese identificador interno.");
  if (!categoryExists(database, product.category)) {
    throw httpError(400, `La categoría "${product.category}" no existe.`);
  }
  validateProductLists(product);
  validateProductTexts(product);
};

/* ---------- Auditoría de ediciones (Etapa 5) ---------- */

/** Campos comparados para registrar qué cambió en cada edición. */
const AUDITED_FIELDS = [
  "name", "sku", "slug", "category", "subcategory", "price", "comparePrice",
  "stock", "images", "shortDescription", "description", "specs", "variants",
  "tags", "featured", "active"
];

/** Diferencias campo por campo entre el producto antes y después de editar. */
const diffProducts = (before, after) =>
  AUDITED_FIELDS
    .filter((field) =>
      JSON.stringify(before[field] === undefined ? null : before[field]) !==
      JSON.stringify(after[field] === undefined ? null : after[field]))
    .map((field) => ({
      field,
      before: before[field] === undefined ? null : before[field],
      after: after[field] === undefined ? null : after[field]
    }));

/** Listado con filtros, orden y paginación (mismos datos que ve el formulario). */
const listProducts = (database, query, now) =>
  listCatalogProductsAdminPaged(database, parseListFilters(query), now);

/** Un producto para editar, o 404. */
const getProduct = (database, id, now) => {
  const product = getProductForAdmin(database, id, now);
  if (!product) throw httpError(404, "Producto no encontrado.");
  return product;
};

/** Crea un producto nuevo con validación completa. */
const createProduct = (database, body, now) => {
  const product = normalizeProductInput(body);
  validateForSave(database, product);
  product.sortOrder = nextProductSortOrder(database);
  upsertProductRow(database, product);
  const created = getProductForAdmin(database, product.id, now);
  recordAdminAudit(database, {
    action: "product.create",
    entity: "product",
    entityId: created.id,
    detail: { name: created.name, sku: created.sku, price: created.price, stock: created.stock },
    now
  });
  return created;
};

/** Actualiza un producto existente conservando lo que el formulario no envía. */
const updateProduct = (database, id, body, now) => {
  const existing = getProductForAdmin(database, id, now);
  const product = normalizeProductInput(body, { existing, sold: existing.sold });
  validateForSave(database, product, { excludeId: id });
  product.sortOrder = existing.sortOrder;
  upsertProductRow(database, product);
  const updated = getProductForAdmin(database, id, now);
  const changes = diffProducts(existing, updated);
  recordAdminAudit(database, {
    action: "product.update",
    entity: "product",
    entityId: id,
    detail: {
      name: updated.name,
      changes,
      // Solo precio y stock guardan datos para poder revertir (Etapa 5).
      revertChanges: changes
        .filter((change) => change.field === "price" || change.field === "stock")
        .map((change) => ({
          productId: id,
          name: updated.name,
          sku: updated.sku,
          field: change.field,
          before: change.before,
          after: change.after
        }))
    },
    now
  });
  return updated;
};

/** Duplica un producto: mismo contenido, nuevo SKU/slug, arranca inactivo. */
const duplicateProduct = (database, id, now) => {
  const source = getProductForAdmin(database, id, now);
  const baseSku = source.sku.slice(0, 64);
  let sku = `${baseSku}-COPIA`;
  let slug = `${source.slug}-copia`;
  let copyId = `p_${slugify(sku)}`;
  let attempt = 1;
  while (true) {
    const conflicts = catalogProductConflicts(database, { id: copyId, sku, slug });
    if (!conflicts.idTaken && !conflicts.skuTaken && !conflicts.slugTaken) break;
    attempt += 1;
    sku = `${baseSku}-COPIA${attempt}`;
    slug = `${source.slug}-copia${attempt}`;
    copyId = `p_${slugify(sku)}`;
    if (attempt > 50) throw httpError(409, "No se pudo generar un duplicado único; probá cambiando el SKU original.");
  }
  const copy = {
    ...source,
    id: copyId,
    sku,
    slug,
    name: `${source.name} (copia)`.slice(0, 180),
    active: false,
    createdAt: now ? now.slice(0, 10) : new Date().toISOString().slice(0, 10)
  };
  delete copy.sold;
  delete copy.reserved;
  delete copy.sortOrder;
  copy.sortOrder = nextProductSortOrder(database);
  copy.stock = source.stock + source.sold;
  validateForSave(database, copy);
  upsertProductRow(database, copy);
  const created = getProductForAdmin(database, copy.id, now);
  recordAdminAudit(database, {
    action: "product.duplicate",
    entity: "product",
    entityId: created.id,
    detail: { name: source.name, copyName: created.name, sku: created.sku, sourceId: id },
    now
  });
  return created;
};

/** Activa o desactiva la publicación de un producto. */
const setProductActive = (database, id, active, now) => {
  getProductForAdmin(database, id, now);
  setCatalogProductActive(database, id, active);
  const updated = getProductForAdmin(database, id, now);
  recordAdminAudit(database, {
    action: "product.archive",
    entity: "product",
    entityId: id,
    detail: { name: updated.name, sku: updated.sku, active: Boolean(active) },
    now
  });
  return updated;
};

/** Elimina un producto SOLO si no tiene ventas ni reservas (si no, 409). */
const deleteProduct = (database, id, now) => {
  const existing = getProductForAdmin(database, id, now);
  const removed = deleteProductForAdmin(database, id);
  if (!removed) throw httpError(404, "Producto no encontrado.");
  recordAdminAudit(database, {
    action: "product.delete",
    entity: "product",
    entityId: id,
    detail: existing
      ? { name: existing.name, sku: existing.sku, price: existing.price }
      : {},
    now
  });
};

module.exports = {
  createProduct,
  deleteProduct,
  duplicateProduct,
  getProduct,
  listProducts,
  setProductActive,
  updateProduct,
  validateForSave
};
