const cors = require("cors");
const express = require("express");
const {
  listCategories,
  listProducts,
  getProductBySlug
} = require("./db");

const createApp = ({ database, corsOrigins = [] }) => {
  if (!database) throw new Error("La base SQLite es obligatoria para iniciar la API.");

  const app = express();
  const allowedOrigins = new Set(corsOrigins);

  app.disable("x-powered-by");
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === "null" || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("El origen no está permitido por CORS."));
    },
    methods: ["GET", "HEAD"],
    optionsSuccessStatus: 204
  }));

  app.get("/api/health", (_request, response) => {
    database.prepare("SELECT 1").get();
    response.json({ status: "ok", database: "ok" });
  });

  app.get("/api/products", (_request, response) => {
    response.json({
      categories: listCategories(database),
      products: listProducts(database)
    });
  });

  app.get("/api/products/:slug", (request, response) => {
    const product = getProductBySlug(database, request.params.slug);
    if (!product) {
      response.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    response.json({ product });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Ruta no encontrada." });
  });

  app.use((error, _request, response, _next) => {
    if (error.message === "El origen no está permitido por CORS.") {
      response.status(403).json({ error: error.message });
      return;
    }
    console.error("Error no controlado en la API.", error);
    response.status(500).json({ error: "Error interno del servidor." });
  });

  return app;
};

module.exports = { createApp };
