const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../app");
const { loadCatalogSource } = require("../catalog-source");
const { openDatabase, seedCatalog } = require("../db");

let database;
let server;
let baseUrl;

before(async () => {
  database = openDatabase(":memory:");
  seedCatalog(database, loadCatalogSource());
  server = createApp({ database, corsOrigins: ["https://shop.example"] })
    .listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (database) database.close();
});

test("GET /api/health reports the API and SQLite as ready", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "ok" });
});

test("GET /api/products returns active catalog and categories from SQLite", async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  const catalog = await response.json();
  assert.equal(response.status, 200);
  assert.equal(catalog.products.length, loadCatalogSource().products.filter((item) => item.active).length);
  assert.ok(catalog.products.every((product) => product.active));
  assert.ok(catalog.categories.some((category) => category.id === "cocina"));
});

test("GET /api/products/:slug returns an active product", async () => {
  const response = await fetch(`${baseUrl}/api/products/set-ollas-antiadherente-8-piezas`);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.product.sku, "COC-OLL-008");
});

test("inactive products are omitted from listings and direct lookup", async () => {
  const product = {
    ...loadCatalogSource().products[0],
    id: "test-inactive-product",
    slug: "test-inactive-product",
    sku: "TEST-INACTIVE",
    active: false
  };
  database.prepare(
    "INSERT INTO products (id, slug, sku, category_id, active, sort_order, data) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    product.id,
    product.slug,
    product.sku,
    product.category,
    0,
    999,
    JSON.stringify(product)
  );

  const catalogResponse = await fetch(`${baseUrl}/api/products`);
  const catalog = await catalogResponse.json();
  const detailResponse = await fetch(`${baseUrl}/api/products/${product.slug}`);
  assert.ok(catalog.products.every((entry) => entry.slug !== product.slug));
  assert.equal(detailResponse.status, 404);
});

test("GET /api/products/:slug returns 404 for missing or inactive products", async () => {
  const missing = await fetch(`${baseUrl}/api/products/not-a-product`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Producto no encontrado." });
});

test("CORS permits configured origins and rejects other browser origins", async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://shop.example" }
  });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://shop.example");

  const blocked = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://untrusted.example" }
  });
  assert.equal(blocked.status, 403);
});
