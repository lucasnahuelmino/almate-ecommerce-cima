/* ==========================================================================
   mp-env-check.test.js — Pruebas del verificador de configuración de MP TEST
   --------------------------------------------------------------------------
   Verifican que el comando `npm run check:mp` acepte una configuración
   correcta, rechace credenciales reales o URLs no alcanzables, y nunca
   muestre el valor de los secretos.
   ========================================================================== */

const test = require("node:test");
const assert = require("node:assert/strict");
const { checkMercadoPagoEnv } = require("../services/mp-env-check");

const validEnvironment = () => ({
  MP_ACCESS_TOKEN: "TEST-1234567890-abcdef",
  MP_WEBHOOK_SECRET: "secreto-de-prueba-del-panel",
  PUBLIC_API_URL: "https://prueba.trycloudflare.com",
  FRONTEND_URL: "http://127.0.0.1:8080",
  CORS_ORIGIN: "http://127.0.0.1:8080,http://localhost:8080",
  ADMIN_PASSWORD: ""
});

const codesWithLevel = (items, level) =>
  items.filter((item) => item.level === level).map((item) => item.code);

test("acepta una configuración TEST completa con frontend local", () => {
  const result = checkMercadoPagoEnv(validEnvironment());
  assert.equal(result.ok, true);
  assert.deepEqual(codesWithLevel(result.items, "error"), []);
});

test("acepta abrir la tienda con doble clic (origen null en CORS)", () => {
  const environment = validEnvironment();
  environment.CORS_ORIGIN = "null";
  const result = checkMercadoPagoEnv(environment);
  assert.equal(result.ok, true);
});

test("rechaza credenciales reales", () => {
  const environment = validEnvironment();
  environment.MP_ACCESS_TOKEN = "APP_USR-1234567890-abcdef";
  const result = checkMercadoPagoEnv(environment);
  assert.equal(result.ok, false);
  assert.ok(codesWithLevel(result.items, "error").includes("token-not-test"));
});

test("rechaza una URL de API local (Mercado Pago no puede llegar)", () => {
  const environment = validEnvironment();
  environment.PUBLIC_API_URL = "http://localhost:3000";
  const result = checkMercadoPagoEnv(environment);
  assert.equal(result.ok, false);
  assert.ok(codesWithLevel(result.items, "error").includes("public-api-local"));
});

test("exige HTTPS en la URL pública de la API", () => {
  const environment = validEnvironment();
  environment.PUBLIC_API_URL = "http://api.example.com";
  const result = checkMercadoPagoEnv(environment);
  assert.ok(codesWithLevel(result.items, "error").includes("public-api-not-https"));
});

test("detecta CORS sin el origen del frontend", () => {
  const environment = validEnvironment();
  environment.CORS_ORIGIN = "https://otro-sitio.example";
  const result = checkMercadoPagoEnv(environment);
  assert.equal(result.ok, false);
  assert.ok(codesWithLevel(result.items, "error").includes("cors-frontend"));
});

test("rechaza una contraseña de panel demasiado corta", () => {
  const environment = validEnvironment();
  environment.ADMIN_PASSWORD = "corta";
  const result = checkMercadoPagoEnv(environment);
  assert.equal(result.ok, false);
  assert.ok(codesWithLevel(result.items, "error").includes("admin-password-short"));
});

test("nunca muestra el valor de los secretos", () => {
  const environment = validEnvironment();
  const result = checkMercadoPagoEnv(environment);
  const text = JSON.stringify(result.items);
  assert.equal(text.includes(environment.MP_ACCESS_TOKEN), false);
  assert.equal(text.includes(environment.MP_WEBHOOK_SECRET), false);
});
