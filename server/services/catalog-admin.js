const {
  importCatalogProducts,
  listCatalogProductsForAdmin,
  validateCatalogProducts
} = require("../db");

const columns = [
  "id", "sku", "slug", "name", "category", "subcategory", "price", "stock",
  "active", "comparePrice", "images", "shortDescription", "description",
  "specs", "variants", "tags", "featured", "createdAt"
];
const maxCsvLength = 2 * 1024 * 1024;
const maxProductsPerImport = 1000;

const parseCsvRows = (csv) => {
  if (typeof csv !== "string" || csv.length > maxCsvLength) {
    throw Object.assign(new Error("El CSV supera el límite de 2 MB."), { status: 413 });
  }
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
    } else {
      cell += character;
    }
  }
  if (quoted) throw Object.assign(new Error("El CSV contiene comillas sin cerrar."), { status: 400 });
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) {
    throw Object.assign(new Error("El CSV debe incluir encabezados y al menos un producto."), { status: 400 });
  }
  if (rows.length - 1 > maxProductsPerImport) {
    throw Object.assign(new Error(`El CSV no puede incluir más de ${maxProductsPerImport} productos por importación.`), { status: 400 });
  }
  return rows;
};

const parseBoolean = (value, fallback, label, rowNumber) => {
  if (value.trim() === "") return fallback;
  if (/^(true|1|si|sí)$/i.test(value.trim())) return true;
  if (/^(false|0|no)$/i.test(value.trim())) return false;
  throw Object.assign(new Error(`Fila ${rowNumber}: "${label}" debe ser true o false.`), { status: 400 });
};

const parseJsonCell = (value, fallback, label, rowNumber) => {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw Object.assign(new Error(`Fila ${rowNumber}: "${label}" debe contener JSON válido.`), { status: 400 });
  }
};

const slugify = (value) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const parseCatalogCsv = (csv, existingProducts) => {
  const rows = parseCsvRows(csv);
  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  if (headers.length !== columns.length || columns.some((column) => !headers.includes(column))) {
    throw Object.assign(new Error(`El encabezado debe contener estas columnas: ${columns.join(", ")}.`), { status: 400 });
  }
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const existingBySku = new Map(existingProducts.map((product) => [product.sku, product]));

  return rows.slice(1).map((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      throw Object.assign(new Error(`Fila ${rowNumber}: la cantidad de columnas no coincide con el encabezado.`), { status: 400 });
    }
    const read = (key) => values[indexes.get(key)].trim();
    const sku = read("sku");
    const name = read("name");
    const category = read("category");
    const price = Number(read("price"));
    const stock = Number(read("stock"));
    const comparePriceText = read("comparePrice");
    const comparePrice = comparePriceText ? Number(comparePriceText) : null;
    const old = existingBySku.get(sku);
    const id = read("id") || (old && old.id) || "p_" + slugify(sku);
    const slug = read("slug") || (old && old.slug) || slugify(name);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(sku) || !name || name.length > 180 ||
        !/^[a-zA-Z0-9_-]+$/.test(id) || id.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180 ||
        !/^[a-zA-Z0-9_-]+$/.test(category) ||
        !Number.isSafeInteger(price) || price <= 0 || price > 100000000 ||
        !Number.isSafeInteger(stock) || stock < 0 || stock > 10000000 ||
        (comparePrice !== null && (!Number.isSafeInteger(comparePrice) || comparePrice < 0))) {
      throw Object.assign(new Error(`Fila ${rowNumber}: revisá SKU, ID, slug, nombre, categoría, precio, stock y precio anterior.`), { status: 400 });
    }
    if (old && old.id !== id) {
      throw Object.assign(new Error(`Fila ${rowNumber}: el SKU "${sku}" pertenece al ID "${old.id}", no "${id}".`), { status: 409 });
    }
    const images = read("images").split("|").map((image) => image.trim()).filter(Boolean);
    const tags = read("tags").split("|").map((tag) => tag.trim()).filter(Boolean);
    const specs = parseJsonCell(read("specs"), [], "specs", rowNumber);
    const variants = parseJsonCell(read("variants"), [], "variants", rowNumber);
    if (!Array.isArray(images) || images.length < 1 || images.some((image) => image.length > 500) ||
        !Array.isArray(tags) || !Array.isArray(specs) || !Array.isArray(variants)) {
      throw Object.assign(new Error(`Fila ${rowNumber}: imágenes, etiquetas, specs o variantes no tienen un formato válido.`), { status: 400 });
    }
    const active = parseBoolean(read("active"), old ? old.active : true, "active", rowNumber);
    const featured = parseBoolean(read("featured"), old ? old.featured : false, "featured", rowNumber);
    const createdAt = read("createdAt") || (old && old.createdAt) || new Date().toISOString().slice(0, 10);
    return {
      ...(old || {}),
      id,
      sku,
      slug,
      name,
      category,
      subcategory: read("subcategory"),
      price,
      comparePrice,
      stock,
      images,
      shortDescription: read("shortDescription"),
      description: read("description"),
      specs,
      variants,
      tags,
      featured,
      active,
      createdAt
    };
  });
};

const escapeCsv = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const exportCatalogCsv = (database) => {
  const products = listCatalogProductsForAdmin(database);
  return [
    columns.join(","),
    ...products.map((product) => columns.map((column) => {
      if (column === "images" || column === "tags") return escapeCsv(product[column].join("|"));
      if (column === "specs" || column === "variants") return escapeCsv(JSON.stringify(product[column]));
      return escapeCsv(product[column]);
    }).join(","))
  ].join("\r\n");
};

const importCatalogCsv = (database, csv) => {
  const existing = listCatalogProductsForAdmin(database);
  const products = parseCatalogCsv(csv, existing);
  return importCatalogProducts(database, products);
};

const previewCatalogCsv = (database, csv) => {
  const products = parseCatalogCsv(csv, listCatalogProductsForAdmin(database));
  const counts = validateCatalogProducts(database, products);
  return {
    ...counts,
    products: products.slice(0, 5).map(({ id, sku, name, price, stock }) => ({
      id, sku, name, price, stock
    })),
    total: products.length
  };
};

module.exports = {
  columns,
  exportCatalogCsv,
  importCatalogCsv,
  previewCatalogCsv
};
