const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createAdminAuth } = require("../admin-auth");
const { createApp } = require("../app");
const { loadCatalogSource } = require("../catalog-source");
const { getProductForAdmin, listProducts, openDatabase, seedCatalog } = require("../db");

let database;
let server;
let baseUrl;
let session;
const adminPassword = "unit-test-admin-password-long";

before(async () => {
  database = openDatabase(":memory:");
  seedCatalog(database, loadCatalogSource());
  const adminAuth = createAdminAuth({ password: adminPassword });
  server = createApp({ database, corsOrigins: [], adminAuth })
    .listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin
    },
    body: JSON.stringify({ password: adminPassword })
  });
  session = {
    body: await login.json(),
    cookie: (login.headers.get("set-cookie") || "").split(";")[0]
  };
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (database) database.close();
});

const adminRequest = (route, { method = "GET", body } = {}) => {
  const headers = { Origin: new URL(baseUrl).origin };
  if (session && session.cookie) headers.Cookie = session.cookie;
  if (session && session.body && session.body.csrfToken) {
    headers["X-CSRF-Token"] = session.body.csrfToken;
  }
  if (body) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });
};

const productPayload = (overrides = {}) => ({
  name: "Producto de prueba panel",
  sku: "TEST-PANEL-001",
  slug: "producto-prueba-panel",
  category: "cocina",
  subcategory: "pruebas",
  price: 15000,
  comparePrice: null,
  stock: 5,
  images: ["img/products/set-ollas-antiadherente-8-piezas.svg"],
  shortDescription: "Descripción corta de prueba",
  description: "<p>Descripción de prueba.</p>",
  specs: [{ label: "Material", value: "Aluminio" }],
  variants: [{ id: "v1", label: "Color", options: ["Negro", "Rojo"] }],
  tags: ["prueba"],
  featured: false,
  active: true,
  ...overrides
});

test("admin product routes require the session and CSRF protections", async () => {
  const list = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(list.status, 401);

  const created = await fetch(`${baseUrl}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin
    },
    body: JSON.stringify(productPayload())
  });
  assert.equal(created.status, 401);

  // Con sesión pero sin token CSRF y con origen distinto: 403.
  const noCsrf = await fetch(`${baseUrl}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
      Cookie: session.cookie
    },
    body: JSON.stringify(productPayload({ sku: "TEST-PANEL-NOCSRF", slug: "producto-panel-nocsrf" }))
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM products WHERE sku = ?").get("TEST-PANEL-NOCSRF").count,
    0
  );
});

test("admin can create a product that appears in the public catalog", async () => {
  const response = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload()
  });
  assert.equal(response.status, 201);
  const { product } = await response.json();
  assert.equal(product.name, "Producto de prueba panel");
  assert.equal(product.stock, 5);
  assert.equal(product.active, true);

  const detail = await fetch(`${baseUrl}/api/products/producto-prueba-panel`);
  assert.equal(detail.status, 200);
  const publicProduct = (await detail.json()).product;
  assert.equal(publicProduct.price, 15000);
  assert.equal(publicProduct.stock, 5);
});

test("duplicate SKU, slug or id are rejected with 409", async () => {
  const sameSku = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ slug: "otro-enlace-panel" })
  });
  assert.equal(sameSku.status, 409);
  assert.match((await sameSku.json()).error, /SKU/i);

  const sameSlug = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-002" })
  });
  assert.equal(sameSlug.status, 409);
  assert.match((await sameSlug.json()).error, /enlace/i);
});

test("invalid price, stock or category are rejected with 400", async () => {
  const badPrice = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-BADP", slug: "producto-panel-badp", price: 0 })
  });
  assert.equal(badPrice.status, 400);
  assert.match((await badPrice.json()).error, /precio/i);

  const badStock = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-BADS", slug: "producto-panel-bads", stock: -3 })
  });
  assert.equal(badStock.status, 400);
  assert.match((await badStock.json()).error, /stock/i);

  const badCategory = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-BADC", slug: "producto-panel-badc", category: "no-existe" })
  });
  assert.equal(badCategory.status, 400);
  assert.match((await badCategory.json()).error, /categor/i);
});

test("partial update preserves unmodified fields and keeps stock semantics", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-EDIT", slug: "producto-panel-edit" })
  });
  const { product } = await created.json();

  // Simulamos una venta: 2 unidades vendidas del producto.
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'paid', 1, '{}', ?, ?)"
  ).run("panel-edit-order", new Date().toISOString(), new Date().toISOString());
  database.prepare(
    "INSERT INTO inventory_movements (order_id, product_id, quantity) VALUES (?, ?, ?)"
  ).run("panel-edit-order", product.id, 2);

  // El formulario muestra stock de góndola (5 − 2 vendidas = 3) y al guardar
  // debe persistir 3 + 2 = 5 (las ventas no se borran).
  const storedBefore = getProductForAdmin(database, product.id);
  assert.equal(storedBefore.stock, 3);
  assert.equal(storedBefore.sold, 2);

  const update = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    body: { price: 17500, stock: 3 }
  });
  assert.equal(update.status, 200);
  const updated = (await update.json()).product;
  assert.equal(updated.price, 17500);
  assert.equal(updated.stock, 3);
  assert.equal(updated.name, "Producto de prueba panel");
  assert.equal(updated.sku, "TEST-PANEL-EDIT");
  assert.deepEqual(updated.images, ["img/products/set-ollas-antiadherente-8-piezas.svg"]);
  assert.deepEqual(updated.specs, [{ label: "Material", value: "Aluminio" }]);
  assert.deepEqual(updated.variants, [{ id: "v1", label: "Color", options: ["Negro", "Rojo"] }]);

  // El stock físico guardado debe ser 3 (góndola) + 2 (vendidas) = 5.
  const storedAfter = database.prepare("SELECT data FROM products WHERE id = ?").get(product.id);
  assert.equal(JSON.parse(storedAfter.data).stock, 5);
});

test("stock cannot be lowered below active reservations", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-RESV", slug: "producto-panel-resv", stock: 4 })
  });
  const { product } = await created.json();

  const orderId = "panel-reservation-order";
  const reservationExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'pending', 1, '{}', ?, ?)"
  ).run(orderId, new Date().toISOString(), new Date().toISOString());
  database.prepare(
    "INSERT INTO inventory_reservations (order_id, product_id, quantity, expires_at) VALUES (?, ?, ?, ?)"
  ).run(orderId, product.id, 3, reservationExpires);

  const tooLow = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    body: { stock: 2 }
  });
  assert.equal(tooLow.status, 409);
  assert.match((await tooLow.json()).error, /reserva/i);

  const allowed = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    body: { stock: 3 }
  });
  assert.equal(allowed.status, 200);
});

test("listing supports search, filters and pagination", async () => {
  const search = await adminRequest("/api/admin/products?q=TEST-PANEL-EDIT&limit=5");
  assert.equal(search.status, 200);
  const searchResult = await search.json();
  assert.ok(searchResult.total >= 1);
  assert.ok(searchResult.products.every((product) =>
    product.sku.includes("TEST-PANEL-EDIT") || product.name.toLowerCase().includes("test-panel-edit")));

  const category = await adminRequest("/api/admin/products?category=cocina&limit=5");
  const categoryResult = await category.json();
  assert.ok(categoryResult.products.every((product) => product.category === "cocina"));

  const inactive = await adminRequest("/api/admin/products?active=false");
  const inactiveResult = await inactive.json();
  assert.ok(inactiveResult.products.every((product) => product.active === false));

  const firstPage = await adminRequest("/api/admin/products?limit=3&offset=0");
  const firstPageResult = await firstPage.json();
  assert.equal(firstPageResult.products.length, 3);
  const secondPage = await adminRequest("/api/admin/products?limit=3&offset=3");
  const secondPageResult = await secondPage.json();
  assert.notDeepEqual(
    firstPageResult.products.map((product) => product.id),
    secondPageResult.products.map((product) => product.id)
  );

  const badSort = await adminRequest("/api/admin/products?sort=hacker");
  assert.equal(badSort.status, 400);
});

test("duplicate creates an inactive copy with a new SKU and slug", async () => {
  const source = await adminRequest("/api/admin/products?q=TEST-PANEL-EDIT&limit=1");
  const original = (await source.json()).products[0];

  const response = await adminRequest(`/api/admin/products/${encodeURIComponent(original.id)}/duplicate`, {
    method: "POST"
  });
  assert.equal(response.status, 201);
  const copy = (await response.json()).product;
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.sku, original.sku);
  assert.notEqual(copy.slug, original.slug);
  assert.equal(copy.active, false);
  assert.match(copy.name, /copia/i);
  assert.equal(copy.price, original.price);
});

test("archive toggles product visibility in the public catalog", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-ARCH", slug: "producto-panel-arch" })
  });
  const { product } = await created.json();

  let detail = await fetch(`${baseUrl}/api/products/producto-panel-arch`);
  assert.equal(detail.status, 200);

  const hide = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}/archive`, {
    method: "POST",
    body: { active: false }
  });
  assert.equal(hide.status, 200);
  detail = await fetch(`${baseUrl}/api/products/producto-panel-arch`);
  assert.equal(detail.status, 404);

  const publish = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}/archive`, {
    method: "POST",
    body: { active: true }
  });
  assert.equal(publish.status, 200);
  detail = await fetch(`${baseUrl}/api/products/producto-panel-arch`);
  assert.equal(detail.status, 200);

  const badBody = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}/archive`, {
    method: "POST",
    body: { active: "yes" }
  });
  assert.equal(badBody.status, 400);
});

test("delete removes clean products but keeps sold ones with 409", async () => {
  const clean = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-DELC", slug: "producto-panel-delc" })
  });
  const cleanProduct = (await clean.json()).product;
  const removed = await adminRequest(`/api/admin/products/${encodeURIComponent(cleanProduct.id)}`, {
    method: "DELETE"
  });
  assert.equal(removed.status, 204);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM products WHERE id = ?").get(cleanProduct.id).count,
    0
  );

  const sold = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "TEST-PANEL-DELS", slug: "producto-panel-dels" })
  });
  const soldProduct = (await sold.json()).product;
  const orderId = "panel-delete-order";
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'paid', 1, '{}', ?, ?)"
  ).run(orderId, new Date().toISOString(), new Date().toISOString());
  database.prepare(
    "INSERT INTO inventory_movements (order_id, product_id, quantity) VALUES (?, ?, ?)"
  ).run(orderId, soldProduct.id, 1);

  const blocked = await adminRequest(`/api/admin/products/${encodeURIComponent(soldProduct.id)}`, {
    method: "DELETE"
  });
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /ventas o reservas/i);
  assert.ok(listProducts(database).some((product) => product.id === soldProduct.id));
});

test("unknown product routes return 404", async () => {
  const missing = await adminRequest("/api/admin/products/p_no_existe");
  assert.equal(missing.status, 404);

  const missingDelete = await adminRequest("/api/admin/products/p_no_existe", { method: "DELETE" });
  assert.equal(missingDelete.status, 404);
});
