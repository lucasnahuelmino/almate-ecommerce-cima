const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const ExcelJS = require("exceljs");
const { createAdminAuth } = require("../admin-auth");
const { createApp } = require("../app");
const { loadCatalogSource } = require("../catalog-source");
const {
  getProductForAdmin,
  listCatalogProductsForAdmin,
  openDatabase,
  seedCatalog
} = require("../db");
const { FRIENDLY_HEADERS } = require("../services/catalog-import-enhanced");

let database;
let server;
let baseUrl;
let origin;
let session;
let cookie;
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
  origin = new URL(baseUrl).origin;

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ password: adminPassword })
  });
  session = await login.json();
  cookie = (login.headers.get("set-cookie") || "").split(";")[0];
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (database) database.close();
});

/* ---------- Helpers ---------- */

const adminRequest = (route, { method = "GET", body, contentType, withCsrf = true, useOrigin = true } = {}) => {
  const headers = {};
  if (useOrigin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (withCsrf && session && session.csrfToken) headers["X-CSRF-Token"] = session.csrfToken;
  if (body !== undefined) headers["Content-Type"] = contentType || "application/json";
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body } : {})
  });
};

/** POST con el archivo como cuerpo binario crudo (igual que lo hace el panel). */
const postImport = (route, buffer, options = {}) =>
  adminRequest(route, { method: "POST", body: buffer, contentType: "application/octet-stream", ...options });

const analyze = (csvOrBuffer) => postImport(
  "/api/admin/catalog/enhanced/analyze",
  Buffer.isBuffer(csvOrBuffer) ? csvOrBuffer : Buffer.from(csvOrBuffer, "utf8")
);

const apply = (csvOrBuffer) => postImport(
  "/api/admin/catalog/enhanced/apply",
  Buffer.isBuffer(csvOrBuffer) ? csvOrBuffer : Buffer.from(csvOrBuffer, "utf8")
);

const analyzeOk = async (input) => {
  const response = await analyze(input);
  assert.equal(response.status, 200);
  return response.json();
};

const applyOk = async (input) => {
  const response = await apply(input);
  assert.equal(response.status, 200);
  return response.json();
};

const createTestProduct = async ({ name, sku, price, stock, ...extra }) => {
  const response = await adminRequest("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name,
      sku,
      category: "cocina",
      price,
      stock,
      images: [`img/products/${sku.toLowerCase()}.svg`],
      specs: [],
      variants: [],
      tags: [],
      description: "Descripción base de prueba",
      shortDescription: "",
      featured: false,
      active: true,
      ...extra
    })
  });
  assert.equal(response.status, 201);
  const { product } = await response.json();
  return product;
};

/** Instantánea comparable del catálogo (para probar "no escribió nada"). */
const snapshotCatalog = () => JSON.stringify(listCatalogProductsForAdmin(database)
  .map(({ id, sku, slug, name, category, price, comparePrice, stock, images, description, shortDescription, specs, variants, tags, featured, active }) =>
    ({ id, sku, slug, name, category, price, comparePrice, stock, images, description, shortDescription, specs, variants, tags, featured, active })));

const insertReservation = (productId, quantity) => {
  const now = new Date().toISOString();
  const orderId = `import-test-order-${productId}`;
  database.prepare(
    "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'pending', 0, '{}', ?, ?)"
  ).run(orderId, now, now);
  database.prepare(
    "INSERT INTO inventory_reservations (order_id, product_id, quantity, expires_at) VALUES (?, ?, ?, ?)"
  ).run(orderId, productId, quantity, "2999-12-31T23:59:59.000Z");
};

const buildXlsx = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

const loadXlsx = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
};

/* ---------- Seguridad ---------- */

test("la importación requiere sesión, origen del panel y CSRF", async () => {
  const csv = "SKU,Precio\nIMP-SEG,100\n";

  const noSession = await fetch(`${baseUrl}/api/admin/catalog/enhanced/analyze`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/octet-stream" },
    body: Buffer.from(csv)
  });
  assert.equal(noSession.status, 401);

  const noCsrf = await postImport("/api/admin/catalog/enhanced/analyze", Buffer.from(csv), { withCsrf: false });
  assert.equal(noCsrf.status, 403);

  const crossOrigin = await postImport("/api/admin/catalog/enhanced/apply", Buffer.from(csv), { useOrigin: false });
  assert.equal(crossOrigin.status, 403);

  const templateNoSession = await fetch(`${baseUrl}/api/admin/catalog/template.xlsx`);
  assert.equal(templateNoSession.status, 401);
});

/* ---------- Celdas vacías y VACÍO ---------- */

test("las celdas vacías conservan los datos actuales y solo cambia lo indicado", async () => {
  const product = await createTestProduct({
    name: "Taza import editable",
    sku: "IMP-T1",
    price: 10000,
    stock: 5,
    comparePrice: 12000,
    tags: ["nuevo"]
  });

  const report = await analyzeOk("SKU,Precio,Descripción\nIMP-T1,15000,\n");
  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.update, 1);
  assert.ok(report.rows[0].changes.includes("Precio: $ 10.000 → $ 15.000"));

  const result = await applyOk("SKU,Precio,Descripción\nIMP-T1,15000,\n");
  assert.deepEqual(result.applied, { created: 0, updated: 1 });

  const after2 = getProductForAdmin(database, product.id);
  assert.equal(after2.price, 15000);
  // Todo lo demás se conserva intacto (celda vacía = conservar).
  assert.equal(after2.name, "Taza import editable");
  assert.equal(after2.comparePrice, 12000);
  assert.equal(after2.description, "Descripción base de prueba");
  assert.equal(after2.stock, 5);
  assert.deepEqual(after2.tags, ["nuevo"]);
  assert.deepEqual(after2.images, ["img/products/imp-t1.svg"]);
});

test("VACÍO limpia campos opcionales y no deja vaciar los obligatorios", async () => {
  const product = await createTestProduct({
    name: "Taza import vacío",
    sku: "IMP-V1",
    price: 9000,
    stock: 2,
    comparePrice: 11000
  });

  const cleared = await applyOk("SKU,Precio anterior\nIMP-V1,VACÍO\n");
  assert.deepEqual(cleared.applied, { created: 0, updated: 1 });
  const after2 = getProductForAdmin(database, product.id);
  assert.equal(after2.comparePrice, null);
  assert.equal(after2.price, 9000); // no se tocó

  // Vaciar el nombre de un producto existente es un error de fila, no un borrado.
  const blocked = await analyzeOk("SKU,Nombre\nIMP-V1,VACÍO\n");
  assert.equal(blocked.summary.error, 1);
  assert.equal(blocked.rows[0].action, "error");
  assert.ok(blocked.rows[0].error.includes("Fila 2"));
});

/* ---------- Creación de productos nuevos ---------- */

test("un SKU nuevo crea el producto con valores por defecto y categoría por nombre", async () => {
  const report = await analyzeOk(
    "SKU,Nombre,Categoría,Precio,Stock,Imágenes,Publicado,Destacado,Etiquetas\n" +
    "IMP-NUEVO,Mate pampa,Cocina,7000,3,img/products/mate.svg,Sí,Sí,nuevo|promo\n"
  );
  assert.equal(report.summary.create, 1);

  const result = await applyOk(
    "SKU,Nombre,Categoría,Precio,Stock,Imágenes,Publicado,Destacado,Etiquetas\n" +
    "IMP-NUEVO,Mate pampa,Cocina,7000,3,img/products/mate.svg,Sí,Sí,nuevo|promo\n"
  );
  assert.deepEqual(result.applied, { created: 1, updated: 0 });

  const created = getProductForAdmin(database, "p_imp-nuevo");
  assert.equal(created.name, "Mate pampa");
  assert.equal(created.category, "cocina"); // el nombre "Cocina" resuelve al ID
  assert.equal(created.slug, "mate-pampa");
  assert.equal(created.price, 7000);
  assert.equal(created.stock, 3);
  assert.equal(created.active, true);
  assert.equal(created.featured, true);
  assert.deepEqual(created.tags, ["nuevo", "promo"]);
});

test("un producto nuevo sin imágenes se informa como error y no se aplica", async () => {
  const report = await analyzeOk("SKU,Nombre,Categoría,Precio\nIMP-SINIMG,Sin fotos,Cocina,5000\n");
  assert.equal(report.summary.error, 1);
  assert.ok(report.rows[0].error.includes("imagen"));

  const result = await applyOk("SKU,Nombre,Categoría,Precio\nIMP-SINIMG,Sin fotos,Cocina,5000\n");
  assert.deepEqual(result.applied, { created: 0, updated: 0 });
  assert.equal(getProductForAdmin(database, "p_imp-sinimg"), null);
});

/* ---------- Identificación y duplicados ---------- */

test("un SKU repetido en el archivo detiene ambas filas e importa el resto", async () => {
  const product = await createTestProduct({ name: "Taza import dup", sku: "IMP-DUP", price: 8000, stock: 4 });
  await createTestProduct({ name: "Taza import dup válida", sku: "IMP-DUPB", price: 7700, stock: 1 });
  const csv =
    "SKU,Precio\n" +
    "IMP-DUP,9000\n" +
    "IMP-DUP,9500\n" +
    "IMP-DUPB\n"; // solo SKU, sin cambios

  const report = await analyzeOk(csv);
  assert.equal(report.summary.error, 2);
  assert.ok(report.rows[0].error.includes("varias veces"));
  assert.equal(report.summary.skip, 1);

  const result = await applyOk(csv);
  assert.deepEqual(result.applied, { created: 0, updated: 0 });
  assert.equal(result.summary.skip, 1);
  assert.equal(getProductForAdmin(database, product.id).price, 8000);
});

test("un ID inexistente se informa como error sin frenar las demás filas", async () => {
  const product = await createTestProduct({ name: "Taza import id", sku: "IMP-ID1", price: 6000, stock: 1 });
  const csv =
    "ID,SKU,Precio\n" +
    "p_no-existe,,7000\n" +
    ",IMP-ID1,6500\n";

  const report = await analyzeOk(csv);
  assert.equal(report.summary.error, 1);
  assert.equal(report.summary.update, 1);
  assert.ok(report.rows[0].error.includes("no existe"));

  const result = await applyOk(csv);
  assert.deepEqual(result.applied, { created: 0, updated: 1 });
  assert.equal(getProductForAdmin(database, product.id).price, 6500);
});

test("el stock no puede bajar de las reservas activas", async () => {
  const product = await createTestProduct({ name: "Taza import reservas", sku: "IMP-RES", price: 5000, stock: 5 });
  insertReservation(product.id, 4);

  const report = await analyzeOk("SKU,Stock\nIMP-RES,3\n");
  assert.equal(report.summary.error, 1);
  assert.ok(report.rows[0].error.includes("reservadas"));

  const result = await applyOk("SKU,Stock\nIMP-RES,3\n");
  assert.deepEqual(result.applied, { created: 0, updated: 0 });
  assert.equal(getProductForAdmin(database, product.id).stock, 5);
});

/* ---------- Archivos y seguridad de escritura ---------- */

test("un XLSX inválido devuelve 400 sin modificar el catálogo", async () => {
  const before2 = snapshotCatalog();
  const response = await analyze(Buffer.from("PK\u0003\u0004basura", "utf8"));
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error.includes(".xlsx"));
  assert.equal(snapshotCatalog(), before2);
});

test("un archivo sin cambios no escribe nada", async () => {
  await createTestProduct({ name: "Taza import skip", sku: "IMP-SKIP", price: 4000, stock: 2 });
  const before2 = snapshotCatalog();

  const report = await analyzeOk("SKU\nIMP-SKIP\n");
  assert.equal(report.summary.skip, 1);
  assert.equal(report.summary.update, 0);

  const result = await applyOk("SKU\nIMP-SKIP\n");
  assert.deepEqual(result.applied, { created: 0, updated: 0 });
  assert.equal(snapshotCatalog(), before2);
});

test("las columnas desconocidas se ignoran y se informan", async () => {
  const product = await createTestProduct({ name: "Taza import columnas", sku: "IMP-COL", price: 3000, stock: 1 });
  const report = await analyzeOk("SKU,Precio,Columna rara\nIMP-COL,3200,algo\n");
  assert.deepEqual(report.ignoredColumns, ["Columna rara"]);
  assert.equal(report.summary.update, 1);

  const result = await applyOk("SKU,Precio,Columna rara\nIMP-COL,3200,algo\n");
  assert.equal(result.applied.updated, 1);
  assert.equal(getProductForAdmin(database, product.id).price, 3200);
});

test("el CSV amigable admite punto y coma como separador", async () => {
  const product = await createTestProduct({ name: "Taza import punto coma", sku: "IMP-PC", price: 2000, stock: 1 });
  const result = await applyOk("SKU;Precio\nIMP-PC;2300\n");
  assert.deepEqual(result.applied, { created: 0, updated: 1 });
  assert.equal(getProductForAdmin(database, product.id).price, 2300);
});

/* ---------- Plantilla, exportación y round-trip ---------- */

test("la plantilla se descarga como XLSX con instrucciones y ejemplo", async () => {
  const response = await adminRequest("/api/admin/catalog/template.xlsx");
  assert.equal(response.status, 200);
  assert.ok((response.headers.get("content-type") || "").includes("spreadsheetml"));

  const workbook = await loadXlsx(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Instrucciones", "Productos"]);
  const sheet = workbook.getWorksheet("Productos");
  const headers = sheet.getRow(1).values.slice(1).map((value) => String(value).trim());
  assert.deepEqual(headers, FRIENDLY_HEADERS);
  // Trae un ejemplo ficticio con formato de moneda en la columna de precio.
  assert.equal(String(sheet.getRow(2).getCell(2).value).trim(), "EJEMPLO-001");
  assert.equal(sheet.getColumn("F").numFmt, '"$"#,##0');
});

test("el round-trip exportar → editar → importar solo marca la fila editada", async () => {
  const target = await createTestProduct({ name: "Taza import roundtrip", sku: "IMP-RT", price: 5500, stock: 7 });

  const exported = await adminRequest("/api/admin/catalog/friendly.xlsx");
  assert.equal(exported.status, 200);
  const workbook = await loadXlsx(Buffer.from(await exported.arrayBuffer()));
  const sheet = workbook.getWorksheet("Productos");
  const headerRow = sheet.getRow(1).values;
  const skuColumn = headerRow.findIndex((value) => String(value).trim() === "SKU");
  const priceColumn = headerRow.findIndex((value) => String(value).trim() === "Precio");
  let edited = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (String(row.getCell(skuColumn).text).trim() === "IMP-RT") {
      row.getCell(priceColumn).value = 5800;
      edited += 1;
    }
  });
  assert.equal(edited, 1);
  const editedBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const report = await analyzeOk(editedBuffer);
  assert.equal(report.summary.update, 1);
  assert.equal(report.summary.error, 0);
  assert.equal(report.summary.create, 0);
  assert.equal(report.summary.total, report.summary.skip + report.summary.update);

  const result = await applyOk(editedBuffer);
  assert.deepEqual(result.applied, { created: 0, updated: 1 });
  assert.equal(getProductForAdmin(database, target.id).price, 5800);
});

test("la exportación amigable trae el catálogo completo con datos del panel", async () => {
  const response = await adminRequest("/api/admin/catalog/friendly.xlsx");
  assert.equal(response.status, 200);
  const workbook = await loadXlsx(Buffer.from(await response.arrayBuffer()));
  const sheet = workbook.getWorksheet("Productos");
  const headerRow = sheet.getRow(1).values;
  const skuColumn = headerRow.findIndex((value) => String(value).trim() === "SKU");
  const skus = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    skus.push(String(row.getCell(skuColumn).text).trim());
  });
  // Todos los productos del catálogo (semilla + los creados por esta suite).
  assert.ok(skus.includes("IMP-RT"));
  assert.ok(skus.includes("IMP-NUEVO"));
  assert.ok(skus.length >= listCatalogProductsForAdmin(database).length);
});
