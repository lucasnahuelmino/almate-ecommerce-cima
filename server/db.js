const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const schema = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    sku TEXT NOT NULL UNIQUE,
    category_id TEXT NOT NULL,
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE INDEX IF NOT EXISTS products_active_order
    ON products (active, sort_order);
`;

const openDatabase = (databasePath) => {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.exec(schema);
  return database;
};

const seedCatalog = (database, { categories, products }) => {
  const categoryIds = new Set(categories.map((category) => category.id));
  const seenProductIds = new Set();
  const seenSlugs = new Set();
  const seenSkus = new Set();

  products.forEach((product) => {
    if (!product.id || !product.slug || !product.sku || !categoryIds.has(product.category)) {
      throw new Error(`El producto "${product.name || product.id || "sin identificar"}" tiene datos incompletos o una categoría inexistente.`);
    }
    if (seenProductIds.has(product.id) || seenSlugs.has(product.slug) || seenSkus.has(product.sku)) {
      throw new Error(`El producto "${product.name}" duplica un id, slug o SKU del catálogo.`);
    }
    seenProductIds.add(product.id);
    seenSlugs.add(product.slug);
    seenSkus.add(product.sku);
  });

  const replaceCatalog = database.transaction(() => {
    database.prepare("DELETE FROM products").run();
    database.prepare("DELETE FROM categories").run();

    const insertCategory = database.prepare(
      "INSERT INTO categories (id, slug, sort_order, data) VALUES (?, ?, ?, ?)"
    );
    categories.forEach((category) => {
      insertCategory.run(
        category.id,
        category.slug,
        Number(category.order) || 0,
        JSON.stringify(category)
      );
    });

    const insertProduct = database.prepare(
      "INSERT INTO products (id, slug, sku, category_id, active, sort_order, data) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    products.forEach((product, index) => {
      insertProduct.run(
        product.id,
        product.slug,
        product.sku,
        product.category,
        product.active ? 1 : 0,
        index,
        JSON.stringify(product)
      );
    });
  });

  replaceCatalog();
};

const listCategories = (database) => database.prepare(
  "SELECT data FROM categories ORDER BY sort_order, id"
).all().map((row) => JSON.parse(row.data));

const listProducts = (database) => database.prepare(
  "SELECT data FROM products WHERE active = 1 ORDER BY sort_order, id"
).all().map((row) => JSON.parse(row.data));

const getProductBySlug = (database, slug) => {
  const row = database.prepare(
    "SELECT data FROM products WHERE slug = ? AND active = 1"
  ).get(slug);
  return row ? JSON.parse(row.data) : null;
};

module.exports = {
  openDatabase,
  seedCatalog,
  listCategories,
  listProducts,
  getProductBySlug
};
