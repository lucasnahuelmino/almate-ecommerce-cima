require("dotenv").config();

const path = require("node:path");
const { createAdminAuth } = require("./admin-auth");
const { validateRuntimeConfig } = require("./runtime-config");
const { createApp } = require("./app");
const { loadCatalogSource, loadStoreConfig } = require("./catalog-source");
const { openDatabase, seedCatalog } = require("./db");
const { createCheckoutService } = require("./services/checkout");
const { createMercadoPagoGateway } = require("./services/mercadopago");
const { createWhatsappOrderService } = require("./services/whatsapp-orders");

validateRuntimeConfig(process.env);

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT debe ser un número entre 1 y 65535.");
}
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

const databasePath = process.env.DB_PATH || "./data/orders.sqlite";
const resolvedDatabasePath = path.isAbsolute(databasePath)
  ? databasePath
  : path.resolve(__dirname, databasePath);
const database = openDatabase(resolvedDatabasePath);

try {
  seedCatalog(database, loadCatalogSource());
} catch (error) {
  database.close();
  throw error;
}

const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const checkoutService = createCheckoutService({
  database,
  config: loadStoreConfig(),
  mercadoPago: createMercadoPagoGateway({ accessToken: process.env.MP_ACCESS_TOKEN || "" }),
  frontendUrl: process.env.FRONTEND_URL || "",
  publicApiUrl: process.env.PUBLIC_API_URL || process.env.BASE_URL || "",
  webhookSecret: process.env.MP_WEBHOOK_SECRET || ""
});
const whatsappOrderService = createWhatsappOrderService({
  database,
  config: loadStoreConfig(),
  reservationMinutes: Number(process.env.ORDER_RESERVATION_MINUTES || 30)
});
const adminAuth = createAdminAuth({
  password: process.env.ADMIN_PASSWORD || "",
  secureCookies: process.env.NODE_ENV === "production"
});
const app = createApp({
  database,
  corsOrigins,
  checkoutService,
  whatsappOrderService,
  adminAuth,
  trustProxyHops
});
const server = app.listen(port, () => {
  console.log(`CIMA API escuchando en http://localhost:${port}`);
});

const shutdown = (signal) => {
  console.log(`${signal} recibido; cerrando CIMA API.`);
  server.close((error) => {
    database.close();
    if (error) {
      console.error("No se pudo cerrar el servidor correctamente.", error);
      process.exitCode = 1;
    }
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
