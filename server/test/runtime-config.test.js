const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateRuntimeConfig } = require("../runtime-config");

const validProductionConfig = {
  NODE_ENV: "production",
  FRONTEND_URL: "https://shop.example",
  PUBLIC_API_URL: "https://api.example",
  CORS_ORIGIN: "https://shop.example",
  DB_PATH: "/var/data/orders.sqlite",
  MP_ACCESS_TOKEN: "TEST-token",
  MP_WEBHOOK_SECRET: "test-webhook-secret",
  ADMIN_PASSWORD: "strong-example-admin-password"
};

test("production runtime accepts HTTPS, an allowed frontend, persistent SQLite and TEST credentials", () => {
  assert.doesNotThrow(() => validateRuntimeConfig(validProductionConfig));
});

test("development runtime does not require deployment settings", () => {
  assert.doesNotThrow(() => validateRuntimeConfig({ NODE_ENV: "development" }));
});

test("production runtime rejects non-HTTPS URLs and CORS origins", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, FRONTEND_URL: "http://shop.example" }),
    /FRONTEND_URL debe ser una URL HTTPS pública/
  );
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, CORS_ORIGIN: "https://other.example" }),
    /CORS_ORIGIN debe incluir/
  );
});

test("production runtime requires a persistent absolute SQLite path", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, DB_PATH: "./data/orders.sqlite" }),
    /ruta absoluta en el disco persistente/
  );
});

test("production runtime rejects live Mercado Pago credentials and missing webhook secrets", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, MP_ACCESS_TOKEN: "APP_USR-live-token" }),
    /Los cobros reales están bloqueados/
  );
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, MP_WEBHOOK_SECRET: "" }),
    /MP_WEBHOOK_SECRET es obligatorio/
  );
});

test("production runtime validates optional dashboard password and proxy hop count", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, ADMIN_PASSWORD: "short" }),
    /ADMIN_PASSWORD debe tener al menos 16 caracteres/
  );
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, TRUST_PROXY_HOPS: "-1" }),
    /TRUST_PROXY_HOPS debe ser un entero/
  );
  assert.throws(
    () => validateRuntimeConfig({ ...validProductionConfig, ORDER_RESERVATION_MINUTES: "0" }),
    /ORDER_RESERVATION_MINUTES debe ser un entero/
  );
});
