const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createAdminAuth } = require("../admin-auth");
const { createApp } = require("../app");
const { loadCatalogSource } = require("../catalog-source");
const { catalogImageUsage, openDatabase, seedCatalog } = require("../db");
const { createMediaService } = require("../services/media");

let database;
let server;
let baseUrl;
let session;
let mediaDir;
const adminPassword = "unit-test-admin-password-long";

// Imagen PNG válida de 1×1 px (base64).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// JPEG mínimo válido de 1×1 px.
const JPEG_1x1 = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
  "base64"
);

// WebP mínimo válido de 1×1 px (VP8L).
const WEBP_1x1 = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64"
);

// Imagen con extensión falsa: el contenido es texto, no bytes mágicos de imagen.
const FAKE_IMAGE = Buffer.from("esto no es una imagen, es texto plano");

before(async () => {
  database = openDatabase(":memory:");
  seedCatalog(database, loadCatalogSource());
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "cima-media-test-"));
  const adminAuth = createAdminAuth({ password: adminPassword });
  server = createApp({ database, corsOrigins: [], adminAuth, mediaDirectory: mediaDir })
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
  if (mediaDir) await fs.rm(mediaDir, { recursive: true, force: true });
});

const adminRequest = (route, { method = "GET", body, contentType } = {}) => {
  const headers = { Origin: new URL(baseUrl).origin };
  if (session && session.cookie) headers.Cookie = session.cookie;
  if (session && session.body && session.body.csrfToken) {
    headers["X-CSRF-Token"] = session.body.csrfToken;
  }
  if (body) headers["Content-Type"] = contentType || "application/json";
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body } : {})
  });
};

test("media upload requires session, CSRF and same origin", async () => {
  // Sin sesión → 401
  const noSession = await fetch(`${baseUrl}/api/admin/media`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", Origin: new URL(baseUrl).origin },
    body: PNG_1x1
  });
  assert.equal(noSession.status, 401);

  // Con sesión pero origen distinto → 403
  const wrongOrigin = await fetch(`${baseUrl}/api/admin/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Origin: "https://untrusted.example",
      Cookie: session.cookie
    },
    body: PNG_1x1
  });
  assert.equal(wrongOrigin.status, 403);
});

test("upload accepts PNG, JPEG and WebP and returns UUID-based URL", async () => {
  const cases = [
    { buffer: PNG_1x1, ext: "png", width: 1, height: 1 },
    { buffer: JPEG_1x1, ext: "jpg", width: 1, height: 1 },
    { buffer: WEBP_1x1, ext: "webp", width: 1, height: 1 }
  ];
  for (const { buffer, ext, width, height } of cases) {
    const response = await adminRequest("/api/admin/media", {
      method: "POST",
      body: buffer,
      contentType: "application/octet-stream"
    });
    assert.equal(response.status, 201);
    const { media } = await response.json();
    assert.match(media.name, /^[0-9a-f-]{36}\./);
    assert.ok(media.name.endsWith(`.${ext}`));
    assert.equal(media.url, `/media/${media.name}`);
    assert.equal(media.width, width);
    assert.equal(media.height, height);
    assert.ok(media.size > 0);
    // Verificar que el archivo existe en disco
    const stat = await fs.stat(path.join(mediaDir, media.name));
    assert.ok(stat.isFile());
  }
});

test("upload rejects files that are not real images (magic bytes check)", async () => {
  const response = await adminRequest("/api/admin/media", {
    method: "POST",
    body: FAKE_IMAGE,
    contentType: "application/octet-stream"
  });
  assert.equal(response.status, 400);
  const { error } = await response.json();
  assert.match(error, /imagen válida/i);
});

test("upload rejects oversized files", async () => {
  const oversized = Buffer.alloc(11 * 1024 * 1024); // 11 MB
  const response = await adminRequest("/api/admin/media", {
    method: "POST",
    body: oversized,
    contentType: "application/octet-stream"
  });
  assert.equal(response.status, 400);
  const { error } = await response.json();
  assert.match(error, /tamaño máximo/i);
});

test("upload rejects path traversal and control characters in content type", async () => {
  // Intento de inyectar ruta en el content-type
  const response = await fetch(`${baseUrl}/api/admin/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream; filename=../../etc/passwd",
      Origin: new URL(baseUrl).origin,
      Cookie: session.cookie,
      "X-CSRF-Token": session.body.csrfToken
    },
    body: PNG_1x1
  });
  // El servidor ignora el filename del content-type; el nombre lo genera él.
  assert.equal(response.status, 201);
  const { media } = await response.json();
  assert.match(media.name, /^[0-9a-f-]{36}\.png$/);
  assert.ok(!media.name.includes(".."));
  assert.ok(!media.name.includes("/"));
});

test("media is served from /media with nosniff and inline headers", async () => {
  const upload = await adminRequest("/api/admin/media", {
    method: "POST",
    body: PNG_1x1,
    contentType: "application/octet-stream"
  });
  const { media } = await upload.json();

  const response = await fetch(`${baseUrl}${media.url}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.match(response.headers.get("cache-control"), /immutable/);
});

test("media directory does not allow listing", async () => {
  const response = await fetch(`${baseUrl}/media/`);
  assert.ok(response.status >= 400);
});

test("delete media requires session and rejects path traversal", async () => {
  const noSession = await fetch(`${baseUrl}/api/admin/media/test.png`, {
    method: "DELETE",
    headers: { Origin: new URL(baseUrl).origin }
  });
  assert.equal(noSession.status, 401);

  const traversal = await adminRequest("/api/admin/media/..%2F..%2Fetc%2Fpasswd", {
    method: "DELETE"
  });
  assert.ok(traversal.status >= 400);
});

test("delete unused image returns 204 and removes file from disk", async () => {
  const upload = await adminRequest("/api/admin/media", {
    method: "POST",
    body: PNG_1x1,
    contentType: "application/octet-stream"
  });
  const { media } = await upload.json();

  const filePath = path.join(mediaDir, media.name);
  await fs.access(filePath); // exists

  const response = await adminRequest(`/api/admin/media/${media.name}`, {
    method: "DELETE"
  });
  assert.equal(response.status, 204);
  await assert.rejects(fs.access(filePath)); // removed
});

test("delete image in use returns 409 and keeps file", async () => {
  const upload = await adminRequest("/api/admin/media", {
    method: "POST",
    body: PNG_1x1,
    contentType: "application/octet-stream"
  });
  const { media } = await upload.json();

  // Create a product that uses this image
  const create = await adminRequest("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: "Producto con imagen subida",
      sku: "IMG-TEST-001",
      slug: "producto-con-imagen-subida",
      category: "cocina",
      price: 10000,
      stock: 5,
      images: [media.url],
      specs: [],
      variants: [],
      tags: [],
      description: "",
      shortDescription: "",
      featured: false,
      active: true
    })
  });
  assert.equal(create.status, 201);

  const response = await adminRequest(`/api/admin/media/${media.name}`, {
    method: "DELETE"
  });
  assert.equal(response.status, 409);
  const { error } = await response.json();
  assert.match(error, /en uso/i);

  // File still on disk
  await fs.access(path.join(mediaDir, media.name));
});

test("catalogImageUsage counts products using a specific image", async () => {
  const upload = await adminRequest("/api/admin/media", {
    method: "POST",
    body: PNG_1x1,
    contentType: "application/octet-stream"
  });
  const { media } = await upload.json();

  assert.equal(catalogImageUsage(database, media.url), 0);

  await adminRequest("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: "Producto para contar uso",
      sku: "IMG-TEST-002",
      slug: "producto-para-contar-uso",
      category: "cocina",
      price: 10000,
      stock: 5,
      images: [media.url],
      specs: [],
      variants: [],
      tags: [],
      description: "",
      shortDescription: "",
      featured: false,
      active: true
    })
  });

  assert.equal(catalogImageUsage(database, media.url), 1);
});

test("media service generates unique names and never overwrites", async () => {
  const service = createMediaService({ directory: mediaDir });
  const first = await service.store(PNG_1x1);
  const second = await service.store(PNG_1x1);
  assert.notEqual(first.name, second.name);
  // Both files exist
  await fs.access(path.join(mediaDir, first.name));
  await fs.access(path.join(mediaDir, second.name));
});

test("media service validates buffer input", async () => {
  const service = createMediaService({ directory: mediaDir });
  await assert.rejects(
    () => service.store(null),
    { status: 400 }
  );
  await assert.rejects(
    () => service.store(Buffer.alloc(0)),
    { status: 400 }
  );
});

test("media persists across service restarts (same directory)", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cima-media-persist-"));
  try {
    const service1 = createMediaService({ directory: dir });
    const stored = await service1.store(PNG_1x1);

    // New service instance, same directory
    const service2 = createMediaService({ directory: dir });
    const exists = await service2.exists(stored.name);
    assert.equal(exists, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
