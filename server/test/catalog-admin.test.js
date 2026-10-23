const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { loadCatalogSource } = require("../catalog-source");
const { listProducts, openDatabase, seedCatalog } = require("../db");
const {
  exportCatalogCsv,
  importCatalogCsv,
  previewCatalogCsv
} = require("../services/catalog-admin");

let database;

before(() => {
  database = openDatabase(":memory:");
  seedCatalog(database, loadCatalogSource());
});

after(() => database.close());

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const makeCsv = (product) => {
  const header = [
    "id", "sku", "slug", "name", "category", "subcategory", "price", "stock",
    "active", "comparePrice", "images", "shortDescription", "description",
    "specs", "variants", "tags", "featured", "createdAt"
  ];
  const values = [
    product.id, product.sku, product.slug, product.name, product.category,
    product.subcategory, product.price, product.stock, product.active,
    product.comparePrice, product.images, product.shortDescription, product.description,
    product.specs, product.variants, product.tags, product.featured, product.createdAt
  ];
  return [header.join(","), values.map(csvCell).join(",")].join("\r\n");
};

test("CSV preview validates without writing and import creates a product", () => {
  const csv = makeCsv({
    id: "p_csv_test",
    sku: "TEST-CSV-001",
    slug: "producto-de-prueba-csv",
    name: "Producto de prueba, CSV",
    category: "cocina",
    subcategory: "pruebas",
    price: 12345,
    stock: 7,
    active: true,
    comparePrice: "",
    images: "img/products/set-ollas-antiadherente-8-piezas.svg",
    shortDescription: "Descripción breve",
    description: "<p>Descripción con, coma y \"comillas\".</p>",
    specs: '[{"label":"Material","value":"Acero"}]',
    variants: "[]",
    tags: "nuevo|destacado",
    featured: false,
    createdAt: "2026-05-20"
  });
  const preview = previewCatalogCsv(database, csv);
  assert.deepEqual(
    { added: preview.added, updated: preview.updated, total: preview.total },
    { added: 1, updated: 0, total: 1 }
  );
  assert.equal(database.prepare("SELECT 1 FROM products WHERE id = ?").get("p_csv_test"), undefined);

  assert.deepEqual(importCatalogCsv(database, csv), { added: 1, updated: 0 });
  const imported = listProducts(database).find((product) => product.id === "p_csv_test");
  assert.equal(imported.price, 12345);
  assert.equal(imported.stock, 7);
  assert.equal(imported.description, '<p>Descripción con, coma y "comillas".</p>');
  seedCatalog(database, loadCatalogSource());
  assert.equal(listProducts(database).find((product) => product.id === "p_csv_test").price, 12345);
});

test("CSV import rejects invalid rows atomically", () => {
  const initialCount = database.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const csv = makeCsv({
    id: "p_invalid_csv",
    sku: "TEST-CSV-BAD",
    slug: "producto-csv-invalido",
    name: "Producto inválido",
    category: "categoria-inexistente",
    subcategory: "",
    price: 1000,
    stock: 2,
    active: true,
    comparePrice: "",
    images: "img/products/missing.svg",
    shortDescription: "",
    description: "",
    specs: "[]",
    variants: "[]",
    tags: "",
    featured: false,
    createdAt: "2026-05-20"
  });
  assert.throws(() => previewCatalogCsv(database, csv), /categoría .* no existe/i);
  assert.throws(() => importCatalogCsv(database, csv), /categoría .* no existe/i);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM products").get().count, initialCount);
});

test("CSV export preserves stock after completed inventory movements", () => {
  const product = loadCatalogSource().products.find((entry) => entry.id === "p_0002");
  const orderId = "csv-export-test-order";
  const createdAt = new Date().toISOString();
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'paid', 1, '{}', ?, ?)"
  ).run(orderId, createdAt, createdAt);
  database.prepare(
    "INSERT INTO inventory_movements (order_id, product_id, quantity) VALUES (?, ?, ?)"
  ).run(orderId, product.id, 2);
  const exported = exportCatalogCsv(database);
  assert.match(exported, /COC-SAR-028/);
  assert.equal(listProducts(database).find((entry) => entry.id === product.id).stock, product.stock - 2);
  importCatalogCsv(database, exported);
  assert.equal(listProducts(database).find((entry) => entry.id === product.id).stock, product.stock - 2);
});
