const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { after, before, test } = require("node:test");
const { createAdminAuth } = require("../admin-auth");
const { createApp } = require("../app");
const { loadCatalogSource, loadStoreConfig } = require("../catalog-source");
const { failPendingOrder, listProducts, openDatabase, seedCatalog } = require("../db");
const { createCheckoutService } = require("../services/checkout");
const { createWhatsappOrderService } = require("../services/whatsapp-orders");

let database;
let server;
let baseUrl;
let paymentService;
let whatsappOrderService;
let payments;
let preferences;
let adminAuth;
const webhookSecret = "unit-test-webhook-secret";
const adminPassword = "unit-test-admin-password-long";

before(async () => {
  database = openDatabase(":memory:");
  seedCatalog(database, loadCatalogSource());
  payments = new Map();
  preferences = [];
  const gateway = {
    async createPreference(body) {
      preferences.push(body);
      const id = `test-preference-${preferences.length}`;
      return {
        id,
        sandbox_init_point: `https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=${id}`
      };
    },
    async getPayment(id) {
      const payment = payments.get(String(id));
      if (!payment) throw new Error("Payment fixture missing.");
      return payment;
    }
  };
  paymentService = createCheckoutService({
    database,
    config: loadStoreConfig(),
    mercadoPago: gateway,
    frontendUrl: "http://localhost:8080",
    publicApiUrl: "http://localhost:3000",
    webhookSecret
  });
  whatsappOrderService = createWhatsappOrderService({
    database,
    config: loadStoreConfig()
  });
  adminAuth = createAdminAuth({ password: adminPassword });
  server = createApp({
    database,
    corsOrigins: ["https://shop.example", "null"],
    checkoutService: paymentService,
    whatsappOrderService,
    adminAuth
  })
    .listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

const checkoutPayload = (overrides = {}) => ({
  items: [{ productId: "p_0002", qty: 1, variants: [], unitPrice: 1 }],
  customer: {
    name: "Ana Gomez",
    email: "ana@example.com",
    phone: "5491123456789",
    dni: "30123456"
  },
  shipping: {
    method: "delivery",
    zoneId: "caba-gba",
    address: "Calle Falsa 123",
    city: "Buenos Aires",
    province: "CABA",
    postalCode: "1425"
  },
  ...overrides
});

const postJson = (route, body) => fetch(`${baseUrl}${route}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const postWebhook = (queryId, {
  signedId = queryId,
  timestamp = Math.floor(Date.now() / 1000),
  signatureOverride,
  signatureHeaderOverride,
  omitSignature = false
} = {}) => {
  const requestId = `test-request-${signedId}`;
  const manifest = `id:${String(signedId).toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const signature = signatureOverride || createHmac("sha256", webhookSecret)
    .update(manifest)
    .digest("hex");
  const headers = {
    "Content-Type": "application/json",
    "x-request-id": requestId
  };
  if (!omitSignature) {
    headers["x-signature"] = signatureHeaderOverride || `ts=${timestamp},v1=${signature}`;
  }
  return fetch(`${baseUrl}/api/webhooks/mercadopago?data.id=${encodeURIComponent(queryId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "payment", data: { id: queryId } })
  });
};

const loginAdmin = async (password = adminPassword) => {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin
    },
    body: JSON.stringify({ password })
  });
  return {
    response,
    body: await response.json(),
    cookie: (response.headers.get("set-cookie") || "").split(";")[0]
  };
};

const adminRequest = (route, { method = "GET", session, body, rawBody, contentType } = {}) => {
  const headers = { Origin: new URL(baseUrl).origin };
  if (session && session.cookie) headers.Cookie = session.cookie;
  if (session && session.body && session.body.csrfToken) {
    headers["X-CSRF-Token"] = session.body.csrfToken;
  }
  if (body) headers["Content-Type"] = "application/json";
  if (rawBody !== undefined) headers["Content-Type"] = contentType || "text/csv";
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(rawBody !== undefined ? { body: rawBody } : {})
  });
};

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

  const fileOrigin = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "null" }
  });
  assert.equal(fileOrigin.headers.get("access-control-allow-origin"), "null");

  const checkoutPreflight = await fetch(`${baseUrl}/api/checkout`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://shop.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });
  assert.equal(checkoutPreflight.status, 204);
  assert.equal(checkoutPreflight.headers.get("access-control-allow-origin"), "https://shop.example");
  assert.match(checkoutPreflight.headers.get("access-control-allow-methods"), /\bPOST\b/);
  assert.match(checkoutPreflight.headers.get("access-control-allow-headers"), /content-type/i);
});

test("POST /api/checkout recalculates prices and creates a sandbox preference", async () => {
  const response = await postJson("/api/checkout", checkoutPayload());
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.match(result.orderId, /^[0-9a-f-]{36}$/i);
  assert.equal(result.totals.subtotal, 24900);
  assert.equal(result.totals.shipping, 6500);
  assert.equal(result.totals.total, 31400);
  assert.equal(result.items[0].unitPrice, 24900);
  assert.match(result.initPoint, /^https:\/\/sandbox\.mercadopago\.com\//);
  const preference = preferences.at(-1);
  assert.equal(preference.external_reference, result.orderId);
  assert.equal(preference.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), result.totals.total);
  assert.equal(preference.notification_url, "http://localhost:3000/api/webhooks/mercadopago");
  assert.match(preference.back_urls.success, /gracias\.html\?order=/);
  failPendingOrder(database, result.orderId);
});

test("WhatsApp checkout registers the server-priced order and reserves stock", async () => {
  const stockBefore = listProducts(database).find((product) => product.id === "p_0002").stock;
  const response = await postJson("/api/orders/whatsapp", checkoutPayload({
    payment: { provider: "whatsapp", method: "transfer" }
  }));
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.match(result.orderId, /^[0-9a-f-]{36}$/i);
  assert.match(result.url, /^https:\/\/wa\.me\//);
  assert.equal(result.totals.subtotal, 24900);
  assert.equal(result.totals.discount, 2490);
  assert.equal(result.totals.total, 28910);
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, stockBefore - 1);
  assert.equal(
    database.prepare("SELECT status FROM email_notifications WHERE order_id = ? AND event = 'seller_request'")
      .get(result.orderId).status,
    "disabled"
  );

  database.prepare("UPDATE inventory_reservations SET expires_at = ? WHERE order_id = ?")
    .run("2000-01-01T00:00:00.000Z", result.orderId);
  const replacementResponse = await postJson("/api/orders/whatsapp", checkoutPayload({
    payment: { provider: "whatsapp", method: "whatsapp" }
  }));
  const replacement = await replacementResponse.json();
  assert.equal(replacementResponse.status, 201);
  assert.equal(
    database.prepare("SELECT status FROM orders WHERE order_id = ?").get(result.orderId).status,
    "failed"
  );
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, stockBefore - 1);

  const session = await loginAdmin();
  const release = await adminRequest(`/api/admin/orders/${replacement.orderId}/release-reservation`, {
    method: "POST",
    session
  });

  assert.equal(release.status, 200);
  assert.equal((await release.json()).result.status, "failed");
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, stockBefore);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM order_admin_events WHERE order_id = ?").get(replacement.orderId).count,
    1
  );
});

test("CSV catalog export and validation are protected by the admin session", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/admin/catalog.csv`);
  assert.equal(unauthorized.status, 401);
  const session = await loginAdmin();
  const download = await adminRequest("/api/admin/catalog.csv", { session });
  assert.equal(download.status, 200);
  const csv = await download.text();
  assert.match(csv, /id,sku,slug,name,category/);
  const preview = await adminRequest("/api/admin/catalog/preview", {
    method: "POST",
    session,
    rawBody: csv,
    contentType: "text/csv"
  });
  assert.equal(preview.status, 200);
  assert.ok((await preview.json()).result.updated > 0);
  const invalid = await adminRequest("/api/admin/catalog/preview", {
    method: "POST",
    session,
    rawBody: "invalid,csv\r\n",
    contentType: "text/csv"
  });
  assert.equal(invalid.status, 400);
});

test("checkout is unavailable until a webhook signature secret is configured", async () => {
  const serviceWithoutSecret = createCheckoutService({
    database,
    config: loadStoreConfig(),
    mercadoPago: {
      async createPreference() {
        throw new Error("Preference gateway must not be called.");
      }
    },
    frontendUrl: "http://localhost:8080",
    publicApiUrl: "http://localhost:3000"
  });
  await assert.rejects(
    serviceWithoutSecret.createCheckout(checkoutPayload()),
    { status: 503, message: "El webhook de Mercado Pago no está configurado." }
  );
});

test("POST /api/checkout rejects invalid variants, delivery, and unavailable stock", async () => {
  const invalidVariant = checkoutPayload({
    items: [{ productId: "p_0001", qty: 1, variants: [{ id: "v1", value: "Invisible" }] }]
  });
  const variantResponse = await postJson("/api/checkout", invalidVariant);
  assert.equal(variantResponse.status, 400);

  const invalidDelivery = checkoutPayload({
    shipping: { method: "delivery", zoneId: "unknown", address: "", city: "", province: "", postalCode: "" }
  });
  const deliveryResponse = await postJson("/api/checkout", invalidDelivery);
  assert.equal(deliveryResponse.status, 400);

  const unavailable = checkoutPayload({
    items: [{ productId: "p_0002", qty: 23, variants: [] }]
  });
  const stockResponse = await postJson("/api/checkout", unavailable);
  assert.equal(stockResponse.status, 409);
});

test("checkout reserves inventory, webhook verifies payment and applies it once", async () => {
  const response = await postJson("/api/checkout", checkoutPayload());
  const result = await response.json();
  const stockWhileReserved = listProducts(database).find((product) => product.id === "p_0002").stock;
  assert.equal(stockWhileReserved, 21);
  const competingCheckout = await postJson("/api/checkout", checkoutPayload({
    items: [{ productId: "p_0002", qty: 22, variants: [] }]
  }));
  assert.equal(competingCheckout.status, 409);

  const payment = {
    id: "555001",
    external_reference: result.orderId,
    status: "approved",
    transaction_amount: result.totals.total,
    currency_id: "ARS"
  };
  payments.set(payment.id, payment);
  const webhook = await postWebhook(payment.id);
  const webhookResult = await webhook.json();
  assert.equal(webhook.status, 200);
  assert.equal(webhookResult.result.status, "paid");
  assert.deepEqual(
    database.prepare("SELECT event, status FROM email_notifications WHERE order_id = ? ORDER BY event")
      .all(result.orderId),
    [
      { event: "customer_payment_approved", status: "disabled" },
      { event: "seller_payment_approved", status: "disabled" }
    ]
  );
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, 21);

  const repeated = await postWebhook(payment.id);
  assert.equal((await repeated.json()).result.idempotent, true);
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, 21);
});

test("rejected payments release stock reservations", async () => {
  const response = await postJson("/api/checkout", checkoutPayload());
  const result = await response.json();
  const payment = {
    id: "555003",
    external_reference: result.orderId,
    status: "rejected",
    transaction_amount: result.totals.total,
    currency_id: "ARS"
  };
  payments.set(payment.id, payment);
  const webhook = await postWebhook(payment.id);
  assert.equal(webhook.status, 200);
  assert.equal((await webhook.json()).result.status, "failed");
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, 21);
});

test("GET /api/orders/:id exposes payment status without customer details", async () => {
  const response = await postJson("/api/checkout", checkoutPayload());
  const result = await response.json();
  const orderResponse = await fetch(`${baseUrl}/api/orders/${result.orderId}`);
  const { order } = await orderResponse.json();
  assert.equal(orderResponse.status, 200);
  assert.equal(order.status, "pending");
  assert.equal(order.total, result.totals.total);
  assert.equal(JSON.stringify(order).includes("ana@example.com"), false);
  assert.equal(JSON.stringify(order).includes("30123456"), false);
  failPendingOrder(database, result.orderId);
});

test("admin dashboard requires authentication, lists minimal order data and audits fulfillment changes", async () => {
  const page = await fetch(`${baseUrl}/admin`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.match(await page.text(), /Pedidos — Administración CIMA/);
  const script = await fetch(`${baseUrl}/admin/admin.js`);
  assert.equal(script.status, 200);
  assert.equal(script.headers.get("cache-control"), "no-store");
  assert.match(await script.text(), /X-CSRF-Token/);
  const stylesheet = await fetch(`${baseUrl}/admin/admin.css`);
  assert.equal(stylesheet.status, 200);

  const unauthorized = await adminRequest("/api/admin/orders");
  assert.equal(unauthorized.status, 401);

  const wrongOriginLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ password: adminPassword })
  });
  assert.equal(wrongOriginLogin.status, 403);

  const orderResponse = await postJson("/api/checkout", checkoutPayload());
  const order = await orderResponse.json();
  const session = await loginAdmin();
  const pendingUpdate = await adminRequest(`/api/admin/orders/${order.orderId}/fulfillment`, {
    method: "PATCH",
    session,
    body: { status: "preparing" }
  });
  assert.equal(pendingUpdate.status, 409);

  const payment = {
    id: "555020",
    external_reference: order.orderId,
    status: "approved",
    transaction_amount: order.totals.total,
    currency_id: "ARS"
  };
  payments.set(payment.id, payment);
  const webhook = await postWebhook(payment.id);
  assert.equal(webhook.status, 200);

  assert.equal(session.response.status, 200);
  assert.match(session.cookie, /^cima_admin_session=/);
  const ordersResponse = await adminRequest("/api/admin/orders?limit=20", { session });
  const listed = await ordersResponse.json();
  assert.equal(ordersResponse.status, 200);
  const adminOrder = listed.orders.find((entry) => entry.orderId === order.orderId);
  assert.ok(adminOrder);
  assert.equal(adminOrder.customer.email, "ana@example.com");
  assert.equal(adminOrder.shipping.address, "Calle Falsa 123");
  assert.equal(Object.hasOwn(adminOrder.customer, "dni"), false);

  const csrfDenied = await fetch(`${baseUrl}/api/admin/orders/${order.orderId}/fulfillment`, {
    method: "PATCH",
    headers: {
      Origin: new URL(baseUrl).origin,
      Cookie: session.cookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "preparing" })
  });
  assert.equal(csrfDenied.status, 403);

  const updateResponse = await adminRequest(`/api/admin/orders/${order.orderId}/fulfillment`, {
    method: "PATCH",
    session,
    body: { status: "preparing" }
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).result.status, "preparing");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM order_audit WHERE order_id = ?")
    .get(order.orderId).count, 1);

  const invalidTransition = await adminRequest(`/api/admin/orders/${order.orderId}/fulfillment`, {
    method: "PATCH",
    session,
    body: { status: "delivered" }
  });
  assert.equal(invalidTransition.status, 409);

  const logout = await adminRequest("/api/admin/logout", { method: "POST", session });
  assert.equal(logout.status, 204);
  const expired = await adminRequest("/api/admin/orders", { session });
  assert.equal(expired.status, 401);
});

test("admin dashboard routes return 404 when password protection is not configured", async () => {
  const disabledServer = createApp({ database })
    .listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    disabledServer.once("listening", resolve);
    disabledServer.once("error", reject);
  });
  const disabledUrl = `http://127.0.0.1:${disabledServer.address().port}`;
  try {
    assert.equal((await fetch(`${disabledUrl}/admin`)).status, 404);
    assert.equal((await fetch(`${disabledUrl}/api/admin/orders`)).status, 404);
    const login = await fetch(`${disabledUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: disabledUrl },
      body: JSON.stringify({ password: adminPassword })
    });
    assert.equal(login.status, 404);
  } finally {
    await new Promise((resolve, reject) => {
      disabledServer.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("webhook rejects payment amount or currency mismatches", async () => {
  const stockBefore = listProducts(database).find((product) => product.id === "p_0002").stock;
  const response = await postJson("/api/checkout", checkoutPayload());
  const result = await response.json();
  const payment = {
    id: "555002",
    external_reference: result.orderId,
    status: "approved",
    transaction_amount: result.totals.total - 1,
    currency_id: "ARS"
  };
  payments.set(payment.id, payment);
  const webhook = await postWebhook(payment.id);
  assert.equal(webhook.status, 409);
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, stockBefore - 1);
  failPendingOrder(database, result.orderId);
  assert.equal(listProducts(database).find((product) => product.id === "p_0002").stock, stockBefore);
});

test("webhook rejects missing, malformed, invalid and mismatched signatures", async () => {
  const missing = await postWebhook("555010", { omitSignature: true });
  assert.equal(missing.status, 401);

  const invalid = await postWebhook("555010", { signatureOverride: "0".repeat(64) });
  assert.equal(invalid.status, 401);

  const mismatch = await postWebhook("555011", { signedId: "555012" });
  assert.equal(mismatch.status, 401);

  const malformed = await postWebhook("555013", {
    signatureHeaderOverride: "ts=invalid,v1=not-a-signature"
  });
  assert.equal(malformed.status, 401);
});
