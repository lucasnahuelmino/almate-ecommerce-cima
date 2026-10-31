/* ==========================================================================
   check-mp-env.js — Comando `npm run check:mp`
   --------------------------------------------------------------------------
   Lee server/.env y muestra si la configuración alcanza para probar
   Mercado Pago en modo TEST. No se conecta a internet, no imprime secretos
   y devuelve código de salida 1 si hay algo que impide la prueba.
   ========================================================================== */

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { checkMercadoPagoEnv } = require("../services/mp-env-check");

const symbols = { ok: "[ok]   ", warn: "[aviso]", error: "[error]", info: "[info] " };
const { ok, items } = checkMercadoPagoEnv(process.env);

console.log("Verificación de configuración para Mercado Pago TEST\n");
for (const item of items) {
  console.log((symbols[item.level] || "[info] ") + " " + item.message);
}

console.log("");
if (ok) {
  console.log("Todo listo para empezar la prueba. Siguiente paso: npm start");
  console.log("Guía completa: server/PRUEBA-MERCADOPAGO.md");
} else {
  console.log("Faltan datos: corregí los [error] de arriba en server/.env y volvé a ejecutar npm run check:mp");
  process.exitCode = 1;
}
