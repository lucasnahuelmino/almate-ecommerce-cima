const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createAdminAuth } = require("../admin-auth");
const { createApp } = require("../app");
const { loadCatalogSource } = require("../catalog-source");
const { availableStock, openDatabase, seedCatalog } = require("../db");

let database;
let server;
let baseUrl;
let session;
const adminPassword = "unit-test-admin-password-long";

// Productos de prueba creados con precios y stock conocidos.
let productA; // precio 80000, stock 10
let productB; // precio 20000, stock 5
let orderSeq = 0;

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

  productA = await createTestProduct({
    name: "Producto bulk A",
    sku: "BULK-A",
    price: 80000,
    stock: 10
  });
  productB = await createTestProduct({
    name: "Producto bulk B",
    sku: "BULK-B",
    price: 20000,
    stock: 5
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (database) database.close();
});

const adminRequest = (route, { method = "GET", body, withCsrf = true } = {}) => {
  const headers = { Origin: new URL(baseUrl).origin };
  if (session && session.cookie) headers.Cookie = session.cookie;
  if (withCsrf && session && session.body && session.body.csrfToken) {
    headers["X-CSRF-Token"] = session.body.csrfToken;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
};

const createTestProduct = async ({ name, sku, price, stock }) => {
  const response = await adminRequest("/api/admin/products", {
    method: "POST",
    body: {
      name,
      sku,
      category: "cocina",
      price,
      stock,
      // El catálogo exige al menos una imagen por producto.
      images: ["img/products/bulk-test.svg"],
      specs: [],
      variants: [],
      tags: [],
      description: "",
      shortDescription: "",
      featured: false,
      active: true
    }
  });
  assert.equal(response.status, 201);
  const { product } = await response.json();
  return product;
};

const getProduct = async (id) => {
  const response = await adminRequest(`/api/admin/products/${encodeURIComponent(id)}`);
  assert.equal(response.status, 200);
  const { product } = await response.json();
  return product;
};

const bulk = async (route, input, options = {}) => {
  const response = await adminRequest(route, { method: "POST", body: input, ...options });
  const payload = response.status === 204 ? null : await response.json();
  return { status: response.status, payload };
};

const preview = (input) => bulk("/api/admin/catalog/bulk/preview", input);
const apply = (input) => bulk("/api/admin/catalog/bulk/apply", input);

/** Crea un pedido real (para poder insertar reservas/movimientos con FK válidas). */
const insertTestOrder = () => {
  orderSeq += 1;
  const orderId = `bulk-test-order-${orderSeq}`;
  const now = new Date().toISOString();
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'pending', 0, '{}', ?, ?)"
  ).run(orderId, now, now);
  return orderId;
};

const insertReservation = (productId, quantity) => {
  const orderId = insertTestOrder();
  database.prepare(
    "INSERT INTO inventory_reservations (order_id, product_id, quantity, expires_at) VALUES (?, ?, ?, ?)"
  ).run(orderId, productId, quantity, "2999-12-31T23:59:59.000Z");
};

const insertMovement = (productId, quantity) => {
  const orderId = insertTestOrder();
  database.prepare(
    "INSERT INTO inventory_movements (order_id, product_id, quantity) VALUES (?, ?, ?)"
  ).run(orderId, productId, quantity);
};

const idsScope = (...products) => ({ type: "ids", ids: products.map((product) => product.id) });

test("bulk endpoints require session, same origin and CSRF", async () => {
  const input = {
    scope: { type: "ids", ids: [productA.id] },
    operation: { kind: "active", value: false }
  };

  // Sin sesión (con origen correcto para llegar a la comprobación de sesión)
  const noSession = await fetch(`${baseUrl}/api/admin/catalog/bulk/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin
    },
    body: JSON.stringify(input)
  });
  assert.equal(noSession.status, 401);

  // Origen distinto
  const wrongOrigin = await fetch(`${baseUrl}/api/admin/catalog/bulk/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
      Cookie: session.cookie
    },
    body: JSON.stringify(input)
  });
  assert.equal(wrongOrigin.status, 403);

  // Sin token CSRF
  const noCsrf = await bulk("/api/admin/catalog/bulk/preview", input, { withCsrf: false });
  assert.equal(noCsrf.status, 403);

  // Apply también pide todo
  const applyNoSession = await fetch(`${baseUrl}/api/admin/catalog/bulk/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin
    },
    body: JSON.stringify(input)
  });
  assert.equal(applyNoSession.status, 401);
});

test("price preview computes the expected amount without writing anything", async () => {
  const before = [await getProduct(productA.id), await getProduct(productB.id)];
  assert.deepEqual(before.map((product) => product.price), [80000, 20000]);

  const { status, payload } = await preview({
    scope: idsScope(productA, productB),
    operation: { kind: "price", mode: "percent", direction: "up", value: 10, rounding: "exact" }
  });
  assert.equal(status, 200);
  const result = payload;
  assert.equal(result.field, "price");
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.changes, 2);
  assert.equal(result.summary.blocked, 0);
  assert.deepEqual(result.rows.map((row) => row.next), [88000, 22000]);
  assert.ok(result.rows.every((row) => row.status === "change"));

  // La vista previa no escribió nada.
  const after = [await getProduct(productA.id), await getProduct(productB.id)];
  assert.deepEqual(after, before);
});

test("price rounding options produce the documented amounts", async () => {
  // 80000 − 5 % = 76000 con entero exacto.
  const percent = await preview({
    scope: idsScope(productA),
    operation: { kind: "price", mode: "percent", direction: "down", value: 5, rounding: "exact" }
  });
  assert.equal(percent.payload.rows[0].next, 76000);

  // 80000 − 1005 = 78995 en los tres modos de redondeo.
  const exact = await preview({
    scope: idsScope(productA),
    operation: { kind: "price", mode: "amount", direction: "down", value: 1005, rounding: "exact" }
  });
  assert.equal(exact.payload.rows[0].next, 78995);

  const to10 = await preview({
    scope: idsScope(productA),
    operation: { kind: "price", mode: "amount", direction: "down", value: 1005, rounding: "to10" }
  });
  assert.equal(to10.payload.rows[0].next, 79000);

  const to100 = await preview({
    scope: idsScope(productA),
    operation: { kind: "price", mode: "amount", direction: "down", value: 1005, rounding: "to100" }
  });
  assert.equal(to100.payload.rows[0].next, 79000);
});

test("apply changes only the price: stock and every other field stay the same", async () => {
  const keysToCompare = [
    "name", "sku", "slug", "category", "subcategory", "comparePrice",
    "stock", "sold", "reserved", "images", "shortDescription", "description",
    "specs", "variants", "tags", "featured", "active", "createdAt"
  ];
  const beforeA = await getProduct(productA.id);
  const beforeB = await getProduct(productB.id);

  const { status, payload } = await apply({
    scope: idsScope(productA, productB),
    operation: { kind: "price", mode: "amount", direction: "down", value: 1000, rounding: "exact" }
  });
  assert.equal(status, 200);
  assert.equal(payload.summary.applied, 2);

  const afterA = await getProduct(productA.id);
  const afterB = await getProduct(productB.id);
  assert.equal(afterA.price, 79000);
  assert.equal(afterB.price, 19000);
  keysToCompare.forEach((key) => {
    assert.deepEqual(afterA[key], beforeA[key], `el campo "${key}" de A no debía cambiar`);
    assert.deepEqual(afterB[key], beforeB[key], `el campo "${key}" de B no debía cambiar`);
  });
});

test("a price operation can mix changes and blocked rows: only the valid one is applied", async () => {
  // A: 79000 − 50000 = 29000 (se modifica). B: 19000 − 50000 < 1 (bloqueado).
  const previewResult = await preview({
    scope: idsScope(productA, productB),
    operation: { kind: "price", mode: "amount", direction: "down", value: 50000, rounding: "exact" }
  });
  const rows = previewResult.payload.rows;
  const rowA = rows.find((row) => row.id === productA.id);
  const rowB = rows.find((row) => row.id === productB.id);
  assert.equal(rowA.status, "change");
  assert.equal(rowB.status, "blocked");
  assert.equal(rowB.next, null);
  assert.match(rowB.reason, /precio resultante/i);

  const applied = await apply({
    scope: idsScope(productA, productB),
    operation: { kind: "price", mode: "amount", direction: "down", value: 50000, rounding: "exact" }
  });
  assert.equal(applied.payload.summary.applied, 1);
  assert.equal(applied.payload.summary.blocked, 1);

  assert.equal((await getProduct(productA.id)).price, 29000);
  assert.equal((await getProduct(productB.id)).price, 19000); // intacto
});

test("stock cannot go below active reservations: preview blocks it and apply does not touch it", async () => {
  insertReservation(productB.id, 4); // B tiene 5 de góndola y 4 reservados

  const before = await getProduct(productB.id);
  assert.equal(before.stock, 5);
  assert.equal(before.reserved, 4);

  const previewResult = await preview({
    scope: idsScope(productB),
    operation: { kind: "stock", mode: "decrease", value: 3 }
  });
  const row = previewResult.payload.rows[0];
  assert.equal(row.status, "blocked");
  assert.equal(row.next, null);
  assert.match(row.reason, /reservada/i);

  const applied = await apply({
    scope: idsScope(productB),
    operation: { kind: "stock", mode: "decrease", value: 3 }
  });
  assert.equal(applied.payload.summary.applied, 0);

  const after = await getProduct(productB.id);
  assert.equal(after.stock, 5);
  assert.equal(after.reserved, 4);
});

test("stock increase keeps the shelf-total semantics (data.stock = góndola + vendido)", async () => {
  insertMovement(productA.id, 2); // A pasa a 8 de góndola con 2 vendidos

  const before = await getProduct(productA.id);
  assert.equal(before.stock, 8);
  assert.equal(before.sold, 2);

  const applied = await apply({
    scope: idsScope(productA),
    operation: { kind: "stock", mode: "increase", value: 5 }
  });
  assert.equal(applied.payload.summary.applied, 1);

  const after = await getProduct(productA.id);
  assert.equal(after.stock, 13); // 8 de góndola + 5
  assert.equal(after.sold, 2);

  // El total físico guardado debe ser 15 (13 de góndola + 2 vendidos).
  const stored = JSON.parse(
    database.prepare("SELECT data FROM products WHERE id = ?").get(productA.id).data
  );
  assert.equal(stored.stock, 15);
  assert.equal(availableStock(database, productA.id), 13);
});

test("active and featured operations update only their own field", async () => {
  const hide = await apply({
    scope: idsScope(productA, productB),
    operation: { kind: "active", value: false }
  });
  assert.equal(hide.payload.summary.applied, 2);
  const hiddenA = await getProduct(productA.id);
  const hiddenB = await getProduct(productB.id);
  assert.equal(hiddenA.active, false);
  assert.equal(hiddenB.active, false);
  // El precio no se tocó.
  assert.equal(hiddenA.price, 29000);
  assert.equal(hiddenB.price, 19000);

  const feature = await apply({
    scope: idsScope(productA),
    operation: { kind: "featured", value: true }
  });
  assert.equal(feature.payload.summary.applied, 1);
  const featured = await getProduct(productA.id);
  assert.equal(featured.featured, true);
  assert.equal(featured.active, false); // sigue igual

  // Operación repetida: fila "sin cambios", nada aplicado.
  const repeated = await apply({
    scope: idsScope(productB),
    operation: { kind: "active", value: false }
  });
  assert.equal(repeated.payload.rows[0].status, "noop");
  assert.equal(repeated.payload.summary.applied, 0);
});

test("category scope covers every product of the category without writing", async () => {
  const listed = await adminRequest("/api/admin/products?category=cocina&limit=100");
  const listedPayload = await listed.json();
  assert.ok(listedPayload.total > 0);

  const { status, payload } = await preview({
    scope: { type: "category", category: "cocina" },
    operation: { kind: "featured", value: true }
  });
  assert.equal(status, 200);
  assert.equal(payload.summary.total, listedPayload.total);
  assert.equal(payload.scope.type, "category");

  // Nada escrito: el producto que venía destacado sigue igual que antes.
  const after = await adminRequest("/api/admin/products?category=cocina&limit=100");
  const afterPayload = await after.json();
  assert.equal(afterPayload.total, listedPayload.total);
  assert.deepEqual(afterPayload, listedPayload);
});

test("invalid bulk inputs are rejected with clear messages", async () => {
  const cases = [
    { input: { operation: { kind: "active", value: false } }, match: /productos modificar/i },
    { input: { scope: { type: "ids", ids: [] }, operation: { kind: "active", value: false } }, match: /seleccionados/i },
    { input: { scope: { type: "category", category: "no-existe" }, operation: { kind: "active", value: false } }, match: /no existe/i },
    { input: { scope: idsScope(productA), operation: { kind: "explode" } }, match: /operación válida/i },
    { input: { scope: idsScope(productA), operation: { kind: "price", mode: "percent", direction: "up", value: 5000 } }, match: /entre/i },
    { input: { scope: idsScope(productA), operation: { kind: "price", mode: "amount", direction: "sideways", value: 100 } }, match: /sube o baja/i },
    { input: { scope: idsScope(productA), operation: { kind: "stock", mode: "increase", value: 1.5 } }, match: /entero/i },
    { input: { scope: idsScope(productA), operation: { kind: "active", value: "yes" } }, match: /Sí|No/i }
  ];
  for (const { input, match } of cases) {
    const { status, payload } = await preview(input);
    assert.equal(status, 400, `esperaba 400 para ${JSON.stringify(input)}`);
    assert.match(payload.error, match);
  }

  // Ninguna de las entradas inválidas escribió nada en la base.
  assert.equal((await getProduct(productA.id)).price, 29000);
  assert.equal((await getProduct(productB.id)).price, 19000);
});
