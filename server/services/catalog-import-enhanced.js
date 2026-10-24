/* ==========================================================================
   catalog-import-enhanced.js — Importación amigable de catálogo (Etapa 4)
   --------------------------------------------------------------------------
   Archivo "para humanos": encabezados en español, columnas opcionales,
   Excel (.xlsx) o CSV (comas o punto y coma). Reglas clave:
   • Celda vacía = conservar el valor actual (nunca borra datos).
   • "VACÍO" explícito = vaciar un campo opcional (ej.: precio anterior).
   • Identificación SOLO por ID o SKU (los nombres no identifican nada).
   • Se analiza primero sin escribir; la aplicación corre en UNA transacción.
   • Reutiliza las mismas reglas de validación del panel y del CSV técnico
     (validateForSave) y la misma semántica de stock (góndola + vendido).
   • El CSV técnico existente NO se toca: este formato es complementario.
   ========================================================================== */

const ExcelJS = require("exceljs");
const {
  getProductBySkuForAdmin,
  getProductForAdmin,
  listCatalogProductsForAdmin,
  listCategories,
  nextProductSortOrder,
  upsertProductRow
} = require("../db");
const { parseCsvRows, slugify } = require("./catalog-admin");
const { validateForSave } = require("./catalog-manage");

/** Error con código HTTP listo para el middleware de errores. */
const httpError = (status, message) => Object.assign(new Error(message), { status });

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 1000;
const CLEAR_MARK = "vacio"; // "VACÍO" una vez normalizado (sin acentos, minúsculas)

/* ---------- Encabezados amigables ---------- */

/** Encabezado normalizado (sin acentos, minúsculas, espacios simples). */
const normalizeText = (text) => String(text ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .toLowerCase()
  .trim();

/** alias normalizado → campo interno. La primera columna válida es la que vale. */
const HEADER_ALIASES = {
  id: "id", identificador: "id",
  sku: "sku", codigo: "sku",
  nombre: "name", name: "name",
  categoria: "category",
  subcategoria: "subcategory",
  precio: "price",
  "precio anterior": "comparePrice",
  "precio tachado": "comparePrice",
  "precio de antes": "comparePrice",
  stock: "stock", unidades: "stock",
  imagenes: "images", imagen: "images",
  "descripcion corta": "shortDescription",
  descripcion: "description",
  especificaciones: "specs",
  variantes: "variants",
  etiquetas: "tags", tags: "tags",
  destacado: "featured",
  publicado: "active", activo: "active",
  enlace: "slug", slug: "slug"
};

const FIELD_LABELS = {
  id: "ID",
  sku: "SKU",
  name: "Nombre",
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
  active: "Publicado",
  slug: "Enlace"
};

/** Campos obligatorios cuando la fila crea un producto nuevo. */
const REQUIRED_ON_CREATE = new Set(["name", "category", "price", "images"]);

/** Orden de columnas de la plantilla y de la exportación amigable. */
const FRIENDLY_HEADERS = [
  "ID", "SKU", "Nombre", "Categoría", "Subcategoría", "Precio", "Precio anterior",
  "Stock", "Imágenes", "Descripción corta", "Descripción", "Especificaciones",
  "Variantes", "Etiquetas", "Destacado", "Publicado", "Enlace"
];

/* ---------- Lectura de celdas ---------- */

/** Texto de una celda de Excel (números, fechas, texto enriquecido…). */
const cellToText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined && value.result !== null) return String(value.result);
    return "";
  }
  return String(value);
};

/**
 * Clasifica una celda: keep (vacía → conservar), clear (VACÍO → vaciar)
 * o text (hay valor para aplicar).
 */
const readCell = (raw) => {
  const text = String(raw ?? "").trim();
  if (text === "") return { keep: true };
  if (normalizeText(text).replace(/^\(|\)$/g, "") === CLEAR_MARK) return { clear: true };
  return { keep: false, text };
};

/** Número entero aceptando formato argentino ("89.900") y celdas numéricas. */
const parseIntegerCell = (text, label, rowNumber) => {
  // "$ 1.400,50" → 1400.50 (espacios y $ se ignoran; puntos = miles, coma = decimal)
  const normalized = text.replace(/[$\s\u00a0]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const value = Number(normalized);
  if (normalized === "" || !Number.isFinite(value) || !Number.isSafeInteger(value)) {
    throw httpError(400, `Fila ${rowNumber}: "${label}" debe ser un número entero sin decimales.`);
  }
  return value;
};

const parseBooleanCell = (text, label, rowNumber) => {
  const value = normalizeText(text);
  if (["si", "true", "1", "verdadero"].includes(value)) return true;
  if (["no", "false", "0", "falso"].includes(value)) return false;
  throw httpError(400, `Fila ${rowNumber}: "${label}" debe ser Sí o No.`);
};

/** Listas simples: "a|b" o varias líneas (típico en celdas de Excel). */
const parseListCell = (text) => text
  .split(/[|\r\n]+/)
  .map((item) => item.trim())
  .filter(Boolean);

/** Especificaciones: una por línea (o con ";") en formato "Etiqueta: valor". */
const parseSpecsCell = (text, rowNumber) => {
  const entries = text.split(/\r?\n|;/).map((entry) => entry.trim()).filter(Boolean);
  return entries.map((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1) {
      throw httpError(400, `Fila ${rowNumber}: cada especificación debe ser "Etiqueta: valor".`);
    }
    return { label: entry.slice(0, separator).trim(), value: entry.slice(separator + 1).trim() };
  });
};

/** Variantes: "Color: Negro|Rojo" (una por línea o con ";"). */
const parseVariantsCell = (text, rowNumber) => {
  const entries = text.split(/\r?\n|;/).map((entry) => entry.trim()).filter(Boolean);
  return entries.map((entry, position) => {
    const separator = entry.indexOf(":");
    if (separator < 1) {
      throw httpError(400, `Fila ${rowNumber}: cada variante debe ser "Nombre: Opción|Opción".`);
    }
    return {
      id: `v${position + 1}`,
      label: entry.slice(0, separator).trim(),
      options: entry.slice(separator + 1).split("|").map((option) => option.trim()).filter(Boolean)
    };
  });
};

/* ---------- Lectura del archivo ---------- */

const isXlsx = (buffer) =>
  buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b &&
  (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);

/** Detecta separador de CSV por la línea de encabezados (comas o punto y coma). */
const detectDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const masked = firstLine.replace(/"[^"]*"/g, "");
  const commas = (masked.match(/,/g) || []).length;
  const semicolons = (masked.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
};

/** Devuelve { headers, rows } con los encabezados y las filas de datos. */
const readImportRows = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw httpError(400, "El archivo está vacío.");
  }
  let headers;
  let dataRows;
  if (isXlsx(buffer)) {
    if (buffer.length > MAX_FILE_BYTES) {
      throw httpError(413, "El archivo supera los 10 MB.");
    }
    let workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
    } catch {
      throw httpError(400, "No se pudo leer el archivo .xlsx. Descargá la plantilla y volvé a intentar.");
    }
    let worksheet = null;
    // La hoja útil es la que tenga los encabezados (fila 1 con ID/SKU/Nombre):
    // así el archivo exportado o la plantilla andan aunque traigan "Instrucciones".
    for (const candidate of workbook.worksheets) {
      const names = [];
      candidate.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
        names[column - 1] = normalizeText(cellToText(cell.value));
      });
      if (names.includes("id") || names.includes("sku") || names.includes("nombre")) {
        worksheet = candidate;
        break;
      }
    }
    if (!worksheet) {
      throw httpError(400, "No encontré una hoja con los encabezados de la plantilla. Usá la plantilla como base.");
    }
    if (worksheet.rowCount < 1) {
      throw httpError(400, "El archivo no tiene filas.");
    }
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        values[column - 1] = cellToText(cell.value);
      });
      rows.push(values.map((value) => String(value ?? "").trim()));
    });
    headers = rows[0] || [];
    dataRows = rows.slice(1);
  } else {
    const text = buffer.toString("utf8");
    const rows = parseCsvRows(text, detectDelimiter(text)); // reutiliza el parser CSV existente
    headers = rows[0];
    dataRows = rows.slice(1);
  }
  const cleanHeaders = headers.map((header) => String(header ?? "").replace(/^\uFEFF/, "").trim());
  const kept = dataRows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (!kept.length) {
    throw httpError(400, "El archivo no tiene filas de productos.");
  }
  if (kept.length > MAX_ROWS) {
    throw httpError(400, `El archivo no puede superar ${MAX_ROWS} productos por importación.`);
  }
  return { headers: cleanHeaders, rows: kept };
};

/** Mapea encabezados amigables → campos; devuelve también los ignorados. */
const mapHeaders = (headers) => {
  const index = new Map();
  const ignored = [];
  headers.forEach((header, position) => {
    if (!header) return;
    const field = HEADER_ALIASES[normalizeText(header)];
    if (!field) {
      ignored.push(header);
      return;
    }
    if (index.has(field)) {
      ignored.push(header); // columna repetida: gana la primera y se avisa
      return;
    }
    index.set(field, position);
  });
  if (!index.size) {
    throw httpError(400, "No reconozco ningún encabezado. Descargá la plantilla y usá esos títulos.");
  }
  if (!index.has("id") && !index.has("sku")) {
    throw httpError(400, 'Falta la columna ID o SKU: son las que identifican a cada producto.');
  }
  return { index, ignored };
};

/* ---------- Resolución de categoría (acepta ID o nombre) ---------- */

const createCategoryResolver = (database) => {
  const categories = listCategories(database);
  return (raw) => {
    const value = String(raw).trim();
    const normalized = normalizeText(value);
    const match = categories.find((category) =>
      category.id === value || normalizeText(category.id) === normalized ||
      normalizeText(category.label || "") === normalized);
    if (!match) {
      throw httpError(400, `La categoría "${value}" no existe. Revisá el nombre (ej.: Cocina).`);
    }
    return match.id;
  };
};

/* ---------- Armado del producto y diferencias ---------- */

const formatMoney = (value) => (value === null || value === undefined || value === ""
  ? "vacío"
  : `$ ${Number(value).toLocaleString("es-AR")}`);
const siNo = (value) => (value ? "Sí" : "No");
const countLabel = (list, singular, plural) => `${list.length} ${list.length === 1 ? singular : plural}`;
const textDiff = (label, before, after) => {
  if (before === after) return null;
  if (!before && after) return `${label}: vacía → con texto`;
  if (before && !after) return `${label}: con texto → vacía`;
  return `${label}: modificada`;
};

/** Compara listas por contenido exacto; informa cantidades o "modificadas". */
const addListDiff = (changes, label, before, after, singular, plural) => {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (before.length !== after.length) {
    changes.push(`${label}: ${countLabel(before, singular, plural)} → ${countLabel(after, singular, plural)}`);
  } else {
    changes.push(`${label}: modificadas`);
  }
};

/** Diferencias legibles entre el producto actual y el propuesto (para el informe). */
const describeChanges = (before, after, gondolaBefore, gondolaAfter) => {
  const changes = [];
  const add = (label, oldValue, newValue) => {
    if (oldValue !== newValue) changes.push(`${label}: ${oldValue} → ${newValue}`);
  };
  add("Nombre", before.name, after.name);
  add("SKU", before.sku, after.sku);
  add("Enlace", before.slug, after.slug);
  add("Categoría", before.category, after.category);
  add("Subcategoría", before.subcategory || "vacío", after.subcategory || "vacío");
  add("Precio", formatMoney(before.price), formatMoney(after.price));
  add("Precio anterior", formatMoney(before.comparePrice), formatMoney(after.comparePrice));
  add("Stock", `${gondolaBefore} unidades`, `${gondolaAfter} unidades`);
  add("Destacado", siNo(before.featured), siNo(after.featured));
  add("Publicado", siNo(before.active), siNo(after.active));
  addListDiff(changes, "Imágenes", before.images, after.images, "imagen", "imágenes");
  addListDiff(changes, "Etiquetas", before.tags, after.tags, "etiqueta", "etiquetas");
  // Especificaciones y variantes se comparan sin los IDs internos: el formato
  // amigable los regenera y eso no debe leerse como un cambio real.
  addListDiff(changes, "Especificaciones",
    before.specs.map((spec) => [spec.label, spec.value]),
    after.specs.map((spec) => [spec.label, spec.value]), "ítem", "ítems");
  addListDiff(changes, "Variantes",
    before.variants.map((variant) => [variant.label, variant.options]),
    after.variants.map((variant) => [variant.label, variant.options]), "variante", "variantes");
  [
    ["Descripción corta", "shortDescription"],
    ["Descripción", "description"]
  ].forEach(([label, key]) => {
    const diff = textDiff(label, before[key], after[key]);
    if (diff) changes.push(diff);
  });
  return changes;
};

/**
 * Aplica las celdas de una fila sobre la base (existente o de creación).
 * Vacía = conserva; VACÍO = limpia el campo (solo si es opcional).
 */
const applyCell = (merged, field, raw, { rowNumber, isCreate }) => {
  const cell = readCell(raw);
  if (cell.keep) return;
  if (cell.clear) {
    // Campos que jamás pueden vaciarse (ni siquiera en productos existentes).
    const requiredAlways = field === "name" || field === "sku";
    if ((isCreate && REQUIRED_ON_CREATE.has(field)) || requiredAlways) {
      throw httpError(400, `Fila ${rowNumber}: no podés vaciar "${FIELD_LABELS[field]}".`);
    }
    if (field === "comparePrice") merged.comparePrice = null;
    else if (field === "price" || field === "stock") {
      throw httpError(400, `Fila ${rowNumber}: "${FIELD_LABELS[field]}" no se puede vaciar.`);
    } else if (["images", "specs", "variants", "tags"].includes(field)) merged[field] = [];
    else merged[field] = "";
    return;
  }
  const text = cell.text;
  switch (field) {
    case "name":
      merged.name = text;
      break;
    case "sku":
      merged.sku = text;
      break;
    case "slug":
      merged.slug = text;
      break;
    case "subcategory":
      merged.subcategory = text.slice(0, 80);
      break;
    case "shortDescription":
      merged.shortDescription = text.slice(0, 500);
      break;
    case "description":
      merged.description = text;
      break;
    case "price": {
      const value = parseIntegerCell(text, FIELD_LABELS.price, rowNumber);
      if (value <= 0 || value > 100000000) {
        throw httpError(400, `Fila ${rowNumber}: "Precio" debe estar entre 1 y 100.000.000.`);
      }
      merged.price = value;
      break;
    }
    case "comparePrice": {
      const value = parseIntegerCell(text, FIELD_LABELS.comparePrice, rowNumber);
      if (value < 0 || value > 100000000) {
        throw httpError(400, `Fila ${rowNumber}: "Precio anterior" debe estar entre 0 y 100.000.000.`);
      }
      merged.comparePrice = value;
      break;
    }
    case "stock": {
      const value = parseIntegerCell(text, FIELD_LABELS.stock, rowNumber);
      if (value < 0 || value > 10000000) {
        throw httpError(400, `Fila ${rowNumber}: "Stock" debe estar entre 0 y 10.000.000.`);
      }
      merged.stock = value; // góndola (se convierte al total físico al final)
      break;
    }
    case "images":
      merged.images = parseListCell(text);
      break;
    case "tags":
      merged.tags = parseListCell(text);
      break;
    case "specs":
      merged.specs = parseSpecsCell(text, rowNumber);
      break;
    case "variants":
      merged.variants = parseVariantsCell(text, rowNumber);
      break;
    case "featured":
      merged.featured = parseBooleanCell(text, FIELD_LABELS.featured, rowNumber);
      break;
    case "active":
      merged.active = parseBooleanCell(text, FIELD_LABELS.active, rowNumber);
      break;
    default:
      break;
  }
};

/* ---------- Plan de importación (sin escribir nada) ---------- */

const serializePlan = (plan) => ({
  summary: plan.summary,
  ignoredColumns: plan.ignoredColumns,
  rows: plan.rows.map(({ row, action, id, sku, name, changes, error }) => ({
    row, action, id, sku, name, changes, error
  }))
});

const planImport = async (database, buffer, now) => {
  const { headers, rows: dataRows } = await readImportRows(buffer);
  const { index, ignored } = mapHeaders(headers);
  const resolveCategory = createCategoryResolver(database);

  const entries = [];
  const takenSkus = new Map();
  const takenSlugs = new Map();

  // Pre-chequeo de duplicados: si un mismo producto aparece en varias filas,
  // NINGUNA de esas filas se aplica (no sabemos cuál de los valores es el correcto).
  const cellAt = (values, field) =>
    index.has(field) ? String(values[index.get(field)] ?? "").trim() : "";
  const targetRows = new Map();
  dataRows.forEach((values, position) => {
    const idText = cellAt(values, "id");
    const skuText = cellAt(values, "sku");
    let key = "";
    if (idText) {
      const found = getProductForAdmin(database, idText, now);
      key = found ? found.id : `id:${idText}`;
    } else if (skuText) {
      const found = getProductBySkuForAdmin(database, skuText, now);
      key = found ? found.id : `nuevo:${skuText.toUpperCase()}`;
    }
    if (!key) return;
    const rows = targetRows.get(key) || [];
    rows.push(position + 2);
    targetRows.set(key, rows);
  });

  dataRows.forEach((values, position) => {
    const rowNumber = position + 2; // la fila 1 es el encabezado
    const read = (field) => {
      if (!index.has(field)) return "";
      return String(values[index.get(field)] ?? "").trim();
    };
    const entry = {
      row: rowNumber,
      action: "error",
      id: "",
      sku: read("sku"),
      name: read("name"),
      changes: [],
      error: "",
      product: null,
      sortOrder: null
    };
    try {
      if (values.length > headers.length &&
          values.slice(headers.length).some((cell) => String(cell ?? "").trim() !== "")) {
        throw httpError(400, `Fila ${rowNumber}: hay columnas de más respecto de los encabezados.`);
      }

      // 1. Identificación: SOLO por ID o SKU.
      const idText = read("id");
      const skuText = read("sku");
      let existing = null;
      if (idText) {
        existing = getProductForAdmin(database, idText, now);
        if (!existing) {
          throw httpError(404, `Fila ${rowNumber}: el ID "${idText}" no existe en el catálogo.`);
        }
      } else if (skuText) {
        existing = getProductBySkuForAdmin(database, skuText, now);
      } else {
        throw httpError(400, `Fila ${rowNumber}: falta el ID o el SKU para identificar el producto.`);
      }
      const isCreate = !existing;

      // 2. Duplicados dentro del archivo (fila ambigua = ambas se detienen).
      const targetKey = existing ? existing.id : `nuevo:${skuText.toUpperCase()}`;
      const repeatedRows = targetRows.get(targetKey) || [];
      if (repeatedRows.length > 1) {
        throw httpError(409,
          `Fila ${rowNumber}: el producto aparece varias veces en el archivo (filas ${repeatedRows.join(", ")}). Dejá una sola fila.`);
      }

      // 3. Base: existente o valores por defecto de creación.
      const gondolaBefore = existing ? existing.stock : 0;
      const merged = existing
        ? {
          id: existing.id,
          sku: existing.sku,
          slug: existing.slug,
          name: existing.name,
          category: existing.category,
          subcategory: existing.subcategory,
          price: existing.price,
          comparePrice: existing.comparePrice,
          stock: gondolaBefore,
          images: [...existing.images],
          shortDescription: existing.shortDescription,
          description: existing.description,
          specs: existing.specs,
          variants: existing.variants,
          tags: [...existing.tags],
          featured: existing.featured,
          active: existing.active,
          createdAt: existing.createdAt
        }
        : {
          id: "",
          sku: skuText,
          slug: "",
          name: "",
          category: "",
          subcategory: "",
          price: null,
          comparePrice: null,
          stock: 0,
          images: [],
          shortDescription: "",
          description: "",
          specs: [],
          variants: [],
          tags: [],
          featured: false,
          active: true,
          createdAt: now.slice(0, 10)
        };

      // 4. Celdas: vacía = conservar (la base ya tiene el valor actual).
      const cellFields = [
        "name", "sku", "slug", "subcategory", "price", "comparePrice", "stock",
        "images", "shortDescription", "description", "specs", "variants", "tags",
        "featured", "active"
      ];
      cellFields.forEach((field) => applyCell(merged, field, read(field), { rowNumber, isCreate }));
      // La categoría acepta ID o nombre; no admite vaciarse (siempre hay una).
      const categoryCell = readCell(read("category"));
      if (categoryCell.clear) {
        throw httpError(400, `Fila ${rowNumber}: no podés vaciar "Categoría"; escribí el nombre de otra.`);
      }
      if (!categoryCell.keep) merged.category = resolveCategory(categoryCell.text);

      // 5. Reglas derivadas antes de validar.
      if (isCreate && !merged.name) throw httpError(400, `Fila ${rowNumber}: falta el nombre del producto nuevo.`);
      if (isCreate && !merged.category) throw httpError(400, `Fila ${rowNumber}: falta la categoría del producto nuevo.`);
      if (isCreate && merged.price === null) throw httpError(400, `Fila ${rowNumber}: falta el precio del producto nuevo.`);
      if (isCreate && merged.images.length < 1) {
        throw httpError(400, `Fila ${rowNumber}: un producto nuevo necesita al menos una imagen (ruta en "Imágenes").`);
      }
      merged.slug = merged.slug.trim() || slugify(merged.name);
      if (isCreate) merged.id = `p_${slugify(merged.sku)}`;
      entry.id = merged.id;
      entry.sku = merged.sku;
      entry.name = merged.name;

      // 6. Reservas activas: el stock en góndola no puede bajar de ellas.
      const reserved = existing ? existing.reserved : 0;
      if (merged.stock < reserved) {
        throw httpError(409, `Fila ${rowNumber}: el stock (${merged.stock}) no puede ser menor que las ${reserved} unidades reservadas activas.`);
      }

      // 7. Duplicados de SKU/slug entre filas del MISMO archivo.
      const skuOwner = takenSkus.get(merged.sku.toUpperCase());
      if (skuOwner !== undefined && skuOwner !== rowNumber) {
        throw httpError(409, `Fila ${rowNumber}: el SKU "${merged.sku}" ya se usa en la fila ${skuOwner}.`);
      }
      takenSkus.set(merged.sku.toUpperCase(), rowNumber);
      const slugOwner = takenSlugs.get(merged.slug);
      if (slugOwner !== undefined && slugOwner !== rowNumber) {
        throw httpError(409, `Fila ${rowNumber}: el enlace "${merged.slug}" ya se usa en la fila ${slugOwner}.`);
      }
      takenSlugs.set(merged.slug, rowNumber);

      // 8. Mismas reglas que el panel y el CSV técnico (sin duplicar lógica).
      validateForSave(database, merged, { excludeId: existing ? existing.id : "" });

      // 9. Diferencias para el informe.
      if (existing) {
        const changes = describeChanges(existing, merged, gondolaBefore, merged.stock);
        entry.changes = changes;
        entry.action = changes.length ? "update" : "skip";
        entry.sortOrder = existing.sortOrder;
      } else {
        entry.action = "create";
        entry.changes = ["Producto nuevo"];
      }

      // 10. Conversión de stock: data.stock = góndola + vendido.
      merged.stock += existing ? existing.sold : 0;
      entry.product = merged;
    } catch (error) {
      entry.action = "error";
      entry.error = error && error.message ? error.message : "No se pudo procesar la fila.";
      entry.changes = [];
      entry.product = null;
    }
    entries.push(entry);
  });

  const summary = {
    total: entries.length,
    create: entries.filter((entry) => entry.action === "create").length,
    update: entries.filter((entry) => entry.action === "update").length,
    skip: entries.filter((entry) => entry.action === "skip").length,
    error: entries.filter((entry) => entry.action === "error").length
  };
  return { summary, ignoredColumns: ignored, rows: entries };
};

/* ---------- API pública ---------- */

/** Analiza el archivo y devuelve el informe SIN escribir nada. */
const analyzeCatalogImport = async (database, buffer, now = new Date().toISOString()) =>
  serializePlan(await planImport(database, buffer, now));

/**
 * Aplica el archivo: re-analiza con los datos actuales y escribe todo en UNA
 * transacción (si algo falla, no se aplica nada). Las filas con error se
 * muestran en el informe y quedan sin importar; el resto sí se aplica.
 */
const applyCatalogImport = async (database, buffer, now = new Date().toISOString()) => {
  const plan = await planImport(database, buffer, now);
  const report = serializePlan(plan);
  const writable = plan.rows.filter((entry) => entry.action === "create" || entry.action === "update");
  let created = 0;
  let updated = 0;
  if (writable.length) {
    database.transaction(() => {
      let sortOrder = nextProductSortOrder(database);
      writable.forEach((entry) => {
        entry.product.sortOrder = entry.sortOrder !== null ? entry.sortOrder : sortOrder;
        sortOrder += 1;
        upsertProductRow(database, entry.product);
        if (entry.action === "create") created += 1;
        else updated += 1;
      });
    })();
  }
  return { ...report, applied: { created, updated } };
};

/* ---------- Plantilla y exportación (.xlsx) ---------- */

const INSTRUCTION_LINES = [
  "PLANTILLA DE IMPORTACIÓN — CIMA",
  "",
  "1. Completá la hoja Productos. No cambies los encabezados de la primera fila.",
  "2. Celda vacía = se conserva el valor actual del producto (no borra nada).",
  '3. Para vaciar un valor escribí VACÍO (por ejemplo en "Precio anterior" o "Etiquetas").',
  "4. Cada producto se identifica por ID o por SKU: si el SKU no existe, se crea un producto nuevo.",
  "5. Los precios y el stock son números enteros sin decimales (el stock es el disponible en góndola).",
  '6. Imágenes y etiquetas se separan con | (ej.: img/products/a.webp|img/products/b.webp).',
  '7. Especificaciones: una por línea en formato "Etiqueta: valor".',
  '8. Variantes: "Color: Negro|Rojo" (una por línea). Destacado y Publicado: Sí o No.',
  "9. La categoría puede escribirse como nombre (Cocina) o como identificador (cocina).",
  "10. Al importar primero se analiza el archivo: nada se aplica hasta que confirmes.",
  "11. Las filas con error se listan en el informe y no se importan; el resto de las filas sí.",
  "",
  "Ejemplo (borrá estas dos filas antes de importar):"
];

const styleSheet = (worksheet) => {
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
};

/** Plantilla descargable: hoja de instrucciones + hoja de productos con ejemplo. */
const buildFriendlyTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CIMA";
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.getColumn(1).width = 110;
  INSTRUCTION_LINES.forEach((line) => instructions.addRow([line]));

  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow(FRIENDLY_HEADERS);
  sheet.addRow([
    "", "EJEMPLO-001", "Taza de cerámica blanca", "cocina", "", 3500, 4200, 12,
    "img/products/taza-ejemplo.webp", "Taza para el desayuno", "Taza de cerámica con asa.\nLínea 2 de descripción.",
    "Material: cerámica\nCapacidad: 300 ml", "Color: Blanco|Negro", "nuevo|regalo", "Sí", "Sí", ""
  ]);
  sheet.addRow([
    "", "EJEMPLO-002", "Tabla de picar de madera", "cocina", "", 8900, "", 4,
    "img/products/tabla-ejemplo.webp", "", "", "", "", "", "No", "Sí", ""
  ]);
  sheet.getColumn("F").numFmt = '"$"#,##0';
  sheet.getColumn("G").numFmt = '"$"#,##0';
  sheet.getColumn("C").width = 32;
  sheet.getColumn("I").width = 40;
  sheet.getColumn("K").width = 40;
  sheet.getColumn("L").width = 34;
  sheet.getColumn("M").width = 26;
  styleSheet(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

/** Catálogo actual en formato amigable (para editar en Excel y reimportar). */
const exportCatalogFriendly = async (database) => {
  const products = listCatalogProductsForAdmin(database);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CIMA";
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.getColumn(1).width = 110;
  INSTRUCTION_LINES.slice(0, 11).forEach((line) => instructions.addRow([line]));

  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow(FRIENDLY_HEADERS);
  products.forEach((product) => {
    sheet.addRow([
      product.id,
      product.sku,
      product.name,
      product.category,
      product.subcategory || "",
      product.price,
      product.comparePrice ?? "",
      product.stock, // góndola (disponible), como lo maneja el panel
      product.images.join("|"),
      product.shortDescription || "",
      product.description || "",
      product.specs.map((spec) => `${spec.label}: ${spec.value}`).join("\n"),
      product.variants.map((variant) => `${variant.label}: ${variant.options.join("|")}`).join("\n"),
      product.tags.join("|"),
      siNo(product.featured),
      siNo(product.active),
      product.slug
    ]);
  });
  sheet.getColumn("F").numFmt = '"$"#,##0';
  sheet.getColumn("G").numFmt = '"$"#,##0';
  sheet.getColumn("C").width = 32;
  sheet.getColumn("I").width = 40;
  sheet.getColumn("K").width = 40;
  sheet.getColumn("L").width = 34;
  sheet.getColumn("M").width = 26;
  styleSheet(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

module.exports = {
  analyzeCatalogImport,
  applyCatalogImport,
  buildFriendlyTemplate,
  exportCatalogFriendly,
  FRIENDLY_HEADERS
};
