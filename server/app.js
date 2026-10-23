const cors = require("cors");
const express = require("express");
const path = require("node:path");
const { createAdminAuth } = require("./admin-auth");
const {
  adminDirectory,
  applyAdminPageHeaders,
  createAdminRouter
} = require("./admin-router");
const {
  listCategories,
  listProducts,
  getProductBySlug
} = require("./db");

const createApp = ({
  database,
  corsOrigins = [],
  checkoutService = null,
  whatsappOrderService = null,
  adminAuth = createAdminAuth({}),
  trustProxyHops = 0
}) => {
  if (!database) throw new Error("La base SQLite es obligatoria para iniciar la API.");

  const app = express();
  const allowedOrigins = new Set(corsOrigins);
  const corsMiddleware = cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("El origen no está permitido por CORS."));
    },
    methods: ["GET", "HEAD", "POST"],
    optionsSuccessStatus: 204
  });

  app.disable("x-powered-by");
  app.set("trust proxy", trustProxyHops);
  const jsonParser = express.json({ limit: "32kb", strict: true });
  app.use((request, response, next) => {
    if (request.path.startsWith("/api/admin/")) {
      // El panel de administración aplica su propio parser JSON, con un
      // límite mayor para poder editar descripciones largas de productos.
      next();
      return;
    }
    jsonParser(request, response, next);
  });
  app.use((request, response, next) => {
    if (request.path === "/admin" || request.path.startsWith("/admin/") ||
        request.path.startsWith("/api/admin/")) {
      next();
      return;
    }
    corsMiddleware(request, response, next);
  });

  app.get("/api/health", (_request, response) => {
    database.prepare("SELECT 1").get();
    response.json({ status: "ok", database: "ok" });
  });

  // Imágenes del catálogo (miniaturas del panel y fotos de productos).
  // Son archivos públicos del frontend; se sirven desde el mismo origen
  // para respetar la CSP estricta del panel (img-src 'self').
  app.use("/img", express.static(path.join(__dirname, "..", "img")));

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

  app.post("/api/checkout", async (request, response, next) => {
    if (!checkoutService) {
      response.status(503).json({ error: "El pago de prueba no está configurado." });
      return;
    }
    try {
      response.status(201).json(await checkoutService.createCheckout(request.body));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/orders/whatsapp", (request, response, next) => {
    if (!whatsappOrderService) {
      response.status(503).json({ error: "Los pedidos por WhatsApp no están configurados en el servidor." });
      return;
    }
    try {
      response.status(201).json(whatsappOrderService.createOrder(request.body));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/webhooks/mercadopago", async (request, response, next) => {
    if (!checkoutService) {
      response.status(503).json({ error: "El procesamiento de pagos no está configurado." });
      return;
    }
    const type = request.body && (request.body.type || request.body.topic) ||
      request.query.type || request.query.topic;
    const paymentId = request.query["data.id"];
    try {
      response.json({
        received: true,
        result: await checkoutService.handleWebhook({
          id: paymentId,
          type,
          signature: {
            xSignature: request.get("x-signature"),
            xRequestId: request.get("x-request-id"),
            dataId: paymentId
          }
        })
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/orders/:id", (request, response) => {
    if (!checkoutService || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id)) {
      response.status(404).json({ error: "Pedido no encontrado." });
      return;
    }
    const order = checkoutService.getOrder(request.params.id);
    if (!order) {
      response.status(404).json({ error: "Pedido no encontrado." });
      return;
    }
    response.json({ order });
  });

  app.use("/api/admin", (request, response, next) => {
    if (!adminAuth.enabled) {
      response.status(404).json({ error: "Ruta no encontrada." });
      return;
    }
    next();
  }, createAdminRouter({ database, adminAuth }));

  app.get(["/admin", "/admin/"], applyAdminPageHeaders, (request, response, next) => {
    if (!adminAuth.enabled) {
      response.status(404).end();
      return;
    }
    response.sendFile("index.html", { root: adminDirectory }, (error) => {
      if (error) next(error);
    });
  });
  app.use("/admin", (request, response, next) => {
    if (!adminAuth.enabled) {
      response.status(404).end();
      return;
    }
    applyAdminPageHeaders(request, response, next);
  }, express.static(adminDirectory, { index: false }));

  app.use((_request, response) => {
    response.status(404).json({ error: "Ruta no encontrada." });
  });

  app.use((error, _request, response, _next) => {
    if (error.message === "El origen no está permitido por CORS.") {
      response.status(403).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError && error.status === 400) {
      response.status(400).json({ error: "El cuerpo de la solicitud no contiene JSON válido." });
      return;
    }
    if (error.status === 413) {
      response.status(413).json({ error: "La solicitud supera el tamaño permitido." });
      return;
    }
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Error no controlado en la API.", error);
    response.status(500).json({ error: "Error interno del servidor." });
  });

  return app;
};

module.exports = { createApp };
