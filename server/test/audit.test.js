const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");
const { createAdminAuth } = require("../admin-auth");
const { createApp } = require("../app");
const { loadCatalogSource } = require("../catalog-source");
const { getProductForAdmin, openDatabase, seedCatalog } = require("../db");
const { exportCatalogCsv } = require("../services/catalog-admin");
const {
  RETAINED_BACKUPS,
  createDatabaseBackup,
  listBackupFiles
} = require("../services/backup");

let database;
let server;
let baseUrl;
let session;
let backupDir;
const adminPassword = "unit-test-admin-password-long";
let orderSeq = 0;

before(async () => {
  // Carpeta real de respaldos: la suite verifica que los archivos existen
  // y que pasan integrity_check (se elimina en after).
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "cima-audit-"));
  database = openDatabase(":memory:");
  seedCatalog(database, loadCatalogSource());
  const adminAuth = createAdminAuth({ password: adminPassword });
  server = createApp({ database, corsOrigins: [], adminAuth, backupDirectory: backupDir })
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
  if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true });
});

const adminRequest = (route, { method = "GET", body, contentType, withCsrf = true } = {}) => {
  const headers = { Origin: new URL(baseUrl).origin };
  if (session && session.cookie) headers.Cookie = session.cookie;
  if (withCsrf && session && session.body && session.body.csrfToken) {
    headers["X-CSRF-Token"] = session.body.csrfToken;
  }
  const isJson = body !== undefined && contentType === undefined;
  if (isJson) headers["Content-Type"] = "application/json";
  if (contentType) headers["Content-Type"] = contentType;
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: isJson ? JSON.stringify(body) : body } : {})
  });
};

const productPayload = (overrides = {}) => ({
  name: "Producto de prueba auditoría",
  sku: "AUD-001",
  slug: "producto-prueba-auditoria",
  category: "cocina",
  subcategory: "pruebas",
  price: 15000,
  comparePrice: null,
  stock: 5,
  images: ["img/products/set-ollas-antiadherente-8-piezas.svg"],
  shortDescription: "Descripción corta de prueba",
  description: "<p>Descripción de prueba.</p>",
  specs: [],
  variants: [],
  tags: ["prueba"],
  featured: false,
  active: true,
  ...overrides
});

const getAudit = async (query = "") => {
  const response = await adminRequest(`/api/admin/audit${query}`);
  assert.equal(response.status, 200);
  return response.json();
};

// Busca la entrada más reciente que cumpla el criterio.
const findEntry = async (action, predicate = () => true) => {
  const { entries } = await getAudit("?limit=100");
  return entries.find((entry) => entry.action === action && predicate(entry)) || null;
};

// El detail crudo no viaja en la API (por diseño): se lee de la tabla para
// verificar qué guardó exactamente el registro.
const findDbEntry = (action, predicate = () => true) => {
  const rows = database
    .prepare("SELECT * FROM admin_audit_log ORDER BY id DESC LIMIT 100")
    .all();
  return rows
    .map((row) => ({ ...row, detail: JSON.parse(row.detail || "{}") }))
    .find((row) => row.action === action && predicate(row)) || null;
};

const insertOrder = (total = 1000) => {
  orderSeq += 1;
  const orderId = `audit-test-order-${orderSeq}`;
  const now = new Date().toISOString();
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'pending', ?, '{}', ?, ?)"
  ).run(orderId, total, now, now);
  return orderId;
};

const insertReservation = (orderId, productId, quantity) => {
  database.prepare(
    "INSERT INTO inventory_reservations (order_id, product_id, quantity, expires_at) VALUES (?, ?, ?, ?)"
  ).run(orderId, productId, quantity, new Date(Date.now() + 60 * 60 * 1000).toISOString());
};

/* ---------- Registro de acciones ---------- */

test("creating and editing a product records before/after values", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-EDIT", slug: "producto-aud-edit" })
  });
  assert.equal(created.status, 201);
  const { product } = await created.json();

  const createEntry = await findEntry("product.create", (entry) => entry.entityId === product.id);
  assert.ok(createEntry, "la creación debe quedar registrada");
  assert.equal(createEntry.result, "ok");
  assert.match(createEntry.summary, /Se creó/);

  const patched = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    body: { price: 17500, stock: 8 }
  });
  assert.equal(patched.status, 200);

  const updateEntry = await findEntry(
    "product.update",
    (entry) => entry.entityId === product.id && entry.result === "ok"
  );
  assert.ok(updateEntry, "la edición debe quedar registrada");
  // El resumen debe nombrar los campos con valores anterior → nuevo.
  assert.match(updateEntry.summary, /Precio/);
  assert.match(updateEntry.summary, /Stock/);
  assert.match(updateEntry.summary, /15000|15\.000/);
  // Solo precio/stock habilitan la reversión.
  assert.equal(updateEntry.revertible, true);
});

test("duplicate, archive and delete actions are recorded", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-DEL", slug: "producto-aud-del" })
  });
  const { product } = await created.json();

  const duplicated = await adminRequest(
    `/api/admin/products/${encodeURIComponent(product.id)}/duplicate`,
    { method: "POST" }
  );
  assert.equal(duplicated.status, 201);
  assert.ok(await findEntry("product.duplicate"));

  const archived = await adminRequest(
    `/api/admin/products/${encodeURIComponent(product.id)}/archive`,
    { method: "POST", body: { active: false } }
  );
  assert.equal(archived.status, 200);
  const archiveEntry = await findEntry(
    "product.archive",
    (entry) => entry.entityId === product.id
  );
  assert.ok(archiveEntry);
  assert.match(archiveEntry.summary, /ocultó/);

  const removed = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "DELETE"
  });
  assert.equal(removed.status, 204);
  const deleteEntry = await findEntry(
    "product.delete",
    (entry) => entry.entityId === product.id
  );
  assert.ok(deleteEntry);
  assert.equal(deleteEntry.revertible, false, "un borrado no es reversible");
});

test("failed validations are recorded with an error result", async () => {
  const invalid = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-BAD", slug: "producto-aud-bad", name: "" })
  });
  assert.ok(invalid.status >= 400 && invalid.status < 500);

  const failure = await findEntry("product.create", (entry) => entry.result === "error");
  assert.ok(failure, "el fallo debe quedar registrado");
  assert.match(failure.summary, /Falló/);
});

/* ---------- Respaldos ---------- */

test("csv import creates a verified backup before writing", async () => {
  const before = listBackupFiles(backupDir).length;
  const csv = exportCatalogCsv(database);

  const response = await adminRequest("/api/admin/catalog/import", {
    method: "POST",
    body: csv,
    contentType: "text/plain"
  });
  assert.equal(response.status, 200);
  const { result } = await response.json();
  assert.ok(result && typeof result.added === "number");

  const files = listBackupFiles(backupDir);
  assert.equal(files.length, before + 1, "debe crearse un respaldo nuevo");

  // El respaldo es verificable: abre y pasa integrity_check.
  const backupPath = path.join(backupDir, files[files.length - 1]);
  const check = new Database(backupPath, { readonly: true });
  try {
    const [row] = check.pragma("integrity_check");
    assert.equal(row.integrity_check, "ok");
    const { total } = check.prepare("SELECT COUNT(*) AS total FROM products").get();
    assert.ok(total > 0, "el respaldo debe contener los productos");
  } finally {
    check.close();
  }

  const importEntry = await findEntry("catalog.import");
  assert.ok(importEntry);
  const importDb = findDbEntry("catalog.import");
  assert.equal(importDb.detail.backup, files[files.length - 1]);
  assert.ok(await findEntry("backup.create"));
});

test("friendly import also creates a verified backup", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-IMP", slug: "producto-aud-imp", price: 9000 })
  });
  const { product } = await created.json();

  const before = listBackupFiles(backupDir).length;
  const csv = "SKU,Precio\nAUD-IMP,9500\n";
  const response = await adminRequest("/api/admin/catalog/enhanced/apply", {
    method: "POST",
    body: csv,
    contentType: "application/octet-stream"
  });
  assert.equal(response.status, 200);

  const files = listBackupFiles(backupDir);
  assert.equal(files.length, before + 1);

  const entry = await findEntry("catalog.import.enhanced");
  assert.ok(entry);
  assert.equal(findDbEntry("catalog.import.enhanced").detail.backup, files[files.length - 1]);
  assert.equal(getProductForAdmin(database, product.id).price, 9500);
});

test("backup retention keeps only the newest files", async () => {
  const retentionDir = path.join(backupDir, "retention");
  for (let index = 0; index < RETAINED_BACKUPS + 5; index += 1) {
    await createDatabaseBackup(database, { directory: retentionDir, reason: "test" });
  }
  const files = listBackupFiles(retentionDir);
  assert.equal(files.length, RETAINED_BACKUPS);
  fs.rmSync(retentionDir, { recursive: true, force: true });
});

/* ---------- Cambios masivos ---------- */

test("bulk price change records revert data and can be reverted twice", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-BULK", slug: "producto-aud-bulk", price: 10000, stock: 5 })
  });
  const { product } = await created.json();

  const applied = await adminRequest("/api/admin/catalog/bulk/apply", {
    method: "POST",
    body: {
      scope: { type: "ids", ids: [product.id] },
      operation: { kind: "price", mode: "amount", direction: "up", value: 1500, rounding: "exact" }
    }
  });
  assert.equal(applied.status, 200);
  assert.equal(getProductForAdmin(database, product.id).price, 11500);

  const bulkEntry = await findEntry("catalog.bulk");
  assert.ok(bulkEntry);
  assert.equal(bulkEntry.revertible, true);
  assert.equal(
    findDbEntry("catalog.bulk").detail.backup,
    listBackupFiles(backupDir).at(-1)
  );

  // Revertir restaura EXACTAMENTE el precio anterior.
  const reverted = await adminRequest(`/api/admin/audit/${bulkEntry.id}/revert`, {
    method: "POST"
  });
  assert.equal(reverted.status, 200);
  assert.equal(getProductForAdmin(database, product.id).price, 10000);

  // La reversión queda registrada y también es reversible.
  const revertEntry = await findEntry("audit.revert");
  assert.ok(revertEntry);
  assert.equal(revertEntry.revertible, true);

  const again = await adminRequest(`/api/admin/audit/${revertEntry.id}/revert`, {
    method: "POST"
  });
  assert.equal(again.status, 200);
  assert.equal(getProductForAdmin(database, product.id).price, 11500);
});

test("bulk publish operation is recorded but not revertible", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-PUB", slug: "producto-aud-pub" })
  });
  const { product } = await created.json();

  const applied = await adminRequest("/api/admin/catalog/bulk/apply", {
    method: "POST",
    body: {
      scope: { type: "ids", ids: [product.id] },
      operation: { kind: "active", value: false }
    }
  });
  assert.equal(applied.status, 200);

  const entry = await findEntry("catalog.bulk");
  assert.ok(entry);
  assert.equal(
    findDbEntry("catalog.bulk", (item) => item.detail.field === "active") !== null,
    true,
    "la operación masiva de publicar debe quedar registrada"
  );
  assert.equal(entry.revertible, false, "publicar/ocultar no es reversible");
});

/* ---------- Listado y seguridad del historial ---------- */

test("GET /audit requires the session, paginates and hides raw detail", async () => {
  const noSession = await fetch(`${baseUrl}/api/admin/audit`);
  assert.equal(noSession.status, 401);

  const page = await adminRequest("/api/admin/audit?limit=1&offset=0");
  assert.equal(page.status, 200);
  const body = await page.json();
  assert.equal(body.entries.length, 1);
  assert.ok(body.total > 0);
  assert.equal(Object.prototype.hasOwnProperty.call(body.entries[0], "detail"), false);

  const invalid = await adminRequest("/api/admin/audit?limit=abc");
  assert.equal(invalid.status, 400);
});

test("revert endpoint rejects missing CSRF and unknown ids", async () => {
  const noCsrf = await adminRequest("/api/admin/audit/1/revert", {
    method: "POST",
    withCsrf: false
  });
  assert.equal(noCsrf.status, 403);

  const notANumber = await adminRequest("/api/admin/audit/abc/revert", { method: "POST" });
  assert.equal(notANumber.status, 404);

  const missing = await adminRequest("/api/admin/audit/999999999/revert", { method: "POST" });
  assert.equal(missing.status, 404);
});

test("revert blocked by reservations returns 409 without writing", async () => {
  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-BLOCK", slug: "producto-aud-block", stock: 3 })
  });
  const { product } = await created.json();

  // Sube el stock de 3 a 6: la entrada guardó before=3.
  const raised = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    body: { stock: 6 }
  });
  assert.equal(raised.status, 200);

  // Reserva activa de 5 unidades: revertir dejaría 3 (bajo la reserva).
  const orderId = insertOrder();
  insertReservation(orderId, product.id, 5);

  const updateEntry = await findEntry(
    "product.update",
    (entry) => entry.entityId === product.id && entry.revertible
  );
  assert.ok(updateEntry);

  const reverted = await adminRequest(`/api/admin/audit/${updateEntry.id}/revert`, {
    method: "POST"
  });
  assert.equal(reverted.status, 409);
  assert.match((await reverted.json()).error, /reserva/i);
  assert.equal(
    getProductForAdmin(database, product.id).stock,
    6,
    "no debe escribir nada si la reversión está bloqueada"
  );
});

/* ---------- Integridad de pedidos ---------- */

test("orders and their totals stay intact across audit and reverts", async () => {
  const orderId = insertOrder(45999);
  const snapshot = () => JSON.stringify(
    database.prepare("SELECT * FROM orders ORDER BY order_id").all()
  );
  const before = snapshot();

  const created = await adminRequest("/api/admin/products", {
    method: "POST",
    body: productPayload({ sku: "AUD-ORDER", slug: "producto-aud-order", price: 8000 })
  });
  const { product } = await created.json();
  await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    body: { price: 8400, stock: 9 }
  });
  await adminRequest("/api/admin/catalog/bulk/apply", {
    method: "POST",
    body: {
      scope: { type: "ids", ids: [product.id] },
      operation: { kind: "price", mode: "amount", direction: "down", value: 400, rounding: "exact" }
    }
  });
  const bulkEntry = await findEntry("catalog.bulk", (entry) => entry.revertible);
  await adminRequest(`/api/admin/audit/${bulkEntry.id}/revert`, { method: "POST" });

  assert.equal(snapshot(), before, "los pedidos no deben cambiar");
  const order = database.prepare("SELECT total FROM orders WHERE order_id = ?").get(orderId);
  assert.equal(order.total, 45999);
});
