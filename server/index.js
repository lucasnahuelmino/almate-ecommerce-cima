require("dotenv").config();

const path = require("node:path");
const { createApp } = require("./app");
const { loadCatalogSource } = require("./catalog-source");
const { openDatabase, seedCatalog } = require("./db");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT debe ser un número entre 1 y 65535.");
}

const databasePath = process.env.DB_PATH || "./data/catalog.sqlite";
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
const app = createApp({ database, corsOrigins });
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
