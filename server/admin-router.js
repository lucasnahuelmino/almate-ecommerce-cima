const express = require("express");
const path = require("node:path");
const {
  cancelWhatsappOrder,
  listAdminOrders,
  updateOrderFulfillment,
  catalogImageUsage
} = require("./db");
const {
  exportCatalogCsv,
  importCatalogCsv,
  previewCatalogCsv
} = require("./services/catalog-admin");
const {
  createProduct,
  deleteProduct,
  duplicateProduct,
  getProduct,
  listProducts,
  setProductActive,
  updateProduct
} = require("./services/catalog-manage");
const { listCategories } = require("./db");
const { createMediaService } = require("./services/media");

const privateOrderFields = (request, response, next) => {
  response.set({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  next();
};

const createAdminRouter = ({ database, adminAuth, mediaDirectory = null }) => {
  const router = express.Router();
  const media = mediaDirectory ? createMediaService({ directory: mediaDirectory }) : null;

  const isSameOrigin = (request) =>
    request.get("origin") === `${request.protocol}://${request.get("host")}`;

  const requireSession = (request, response, next) => {
    const session = adminAuth.getSession(request);
    if (!session) {
      response.status(401).json({ error: "Iniciá sesión para continuar." });
      return;
    }
    request.adminSession = session;
    next();
  };

  const requireSameOrigin = (request, response, next) => {
    if (!isSameOrigin(request)) {
      response.status(403).json({ error: "La solicitud debe originarse en el panel de administración." });
      return;
    }
    next();
  };

  const requireCsrf = (request, response, next) => {
    if (!adminAuth.validateCsrfToken(request.adminSession, request.get("x-csrf-token"))) {
      response.status(403).json({ error: "El token de seguridad de la sesión no es válido." });
      return;
    }
    next();
  };

  router.use(privateOrderFields);

  // El parser JSON global no alcanza /api/admin/ (ver app.js); el panel
  // necesita cuerpos más grandes para descripciones de productos largas.
  router.use(express.json({ limit: "128kb", strict: true }));

  router.post("/login", requireSameOrigin, (request, response, next) => {
    try {
      const session = adminAuth.login(request.body && request.body.password, request.ip);
      response.setHeader("Set-Cookie", adminAuth.cookie(session.token));
      response.json({ csrfToken: session.csrfToken });
    } catch (error) {
      next(error);
    }
  });

  router.get("/session", requireSession, (request, response) => {
    response.json({ csrfToken: request.adminSession.csrfToken });
  });

  router.post("/logout", requireSameOrigin, requireSession, requireCsrf, (request, response) => {
    adminAuth.destroySession(request.adminSession.token);
    response.setHeader("Set-Cookie", adminAuth.cookie("", 0));
    response.status(204).end();
  });

  router.get("/orders", requireSession, (request, response) => {
    const limit = Number(request.query.limit || 50);
    const offset = Number(request.query.offset || 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isInteger(offset) || offset < 0 || offset > 100000) {
      response.status(400).json({ error: "La paginación del listado no es válida." });
      return;
    }
    response.json({ orders: listAdminOrders(database, limit, offset) });
  });

  router.get("/catalog.csv", requireSession, (request, response) => {
    response.type("text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="cima-catalogo.csv"');
    response.send(`\uFEFF${exportCatalogCsv(database)}`);
  });

  router.post(
    ["/catalog/preview", "/catalog/import"],
    requireSameOrigin,
    requireSession,
    requireCsrf,
    express.text({ type: ["text/csv", "text/plain"], limit: "2mb" }),
    (request, response, next) => {
      if (typeof request.body !== "string") {
        response.status(400).json({ error: "Enviá el archivo como texto CSV." });
        return;
      }
      try {
        const result = request.path === "/catalog/preview"
          ? previewCatalogCsv(database, request.body)
          : importCatalogCsv(database, request.body);
        response.json({ result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/orders/:id/fulfillment",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id)) {
        response.status(404).json({ error: "Pedido no encontrado." });
        return;
      }
      try {
        const result = updateOrderFulfillment(database, request.params.id, request.body && request.body.status);
        if (!result) {
          response.status(404).json({ error: "Pedido no encontrado." });
          return;
        }
        response.json({ result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/orders/:id/release-reservation",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id)) {
        response.status(404).json({ error: "Pedido no encontrado." });
        return;
      }
      try {
        const result = cancelWhatsappOrder(database, request.params.id);
        if (!result) {
          response.status(404).json({ error: "Pedido no encontrado." });
          return;
        }
        response.json({ result });
      } catch (error) {
        next(error);
      }
    }
  );

  /* ---------- Gestión individual de productos (Etapa 1) ---------- */

  const isValidProductId = (value) => /^[a-zA-Z0-9_-]{1,100}$/.test(value);

  router.get("/categories", requireSession, (request, response) => {
    response.json({ categories: listCategories(database) });
  });

  router.get("/products", requireSession, (request, response, next) => {
    try {
      response.json(listProducts(database, request.query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/products/:id", requireSession, (request, response, next) => {
    if (!isValidProductId(request.params.id)) {
      response.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    try {
      response.json({ product: getProduct(database, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/products",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      try {
        response.status(201).json({ product: createProduct(database, request.body) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/products/:id",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      if (!isValidProductId(request.params.id)) {
        response.status(404).json({ error: "Producto no encontrado." });
        return;
      }
      try {
        response.json({ product: updateProduct(database, request.params.id, request.body) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/products/:id/duplicate",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      if (!isValidProductId(request.params.id)) {
        response.status(404).json({ error: "Producto no encontrado." });
        return;
      }
      try {
        response.status(201).json({ product: duplicateProduct(database, request.params.id) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/products/:id/archive",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      if (!isValidProductId(request.params.id)) {
        response.status(404).json({ error: "Producto no encontrado." });
        return;
      }
      const active = request.body && request.body.active;
      if (typeof active !== "boolean") {
        response.status(400).json({ error: 'Enviá { "active": true } o { "active": false }.' });
        return;
      }
      try {
        response.json({ product: setProductActive(database, request.params.id, active) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/products/:id",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      if (!isValidProductId(request.params.id)) {
        response.status(404).json({ error: "Producto no encontrado." });
        return;
      }
      try {
        deleteProduct(database, request.params.id);
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    }
  );

  /* ---------- Imágenes (Etapa 2) ---------- */

  // El archivo viaja como cuerpo binario crudo (application/octet-stream);
  // el navegador manda solo los bytes, sin nombre ni ruta del lado cliente.
  router.post(
    "/media",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    express.raw({ type: "application/octet-stream", limit: "12mb" }),
    async (request, response, next) => {
      if (!media) {
        response.status(503).json({ error: "La carga de imágenes no está disponible en este servidor." });
        return;
      }
      try {
        const result = await media.store(request.body);
        response.status(201).json({ media: result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/media/:name",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    async (request, response, next) => {
      if (!media) {
        response.status(503).json({ error: "La carga de imágenes no está disponible en este servidor." });
        return;
      }
      const name = request.params.name;
      try {
        // No permitimos rutas del cliente: el servicio valida que el nombre
        // sea un UUID con extensión conocida.
        const exists = await media.exists(name);
        if (!exists) {
          response.status(404).json({ error: "Imagen no encontrada." });
          return;
        }
        const usage = catalogImageUsage(database, `/media/${name}`);
        if (usage > 0) {
          response.status(409).json({
            error: `La imagen está en uso por ${usage} producto${usage > 1 ? "s" : ""}. Quitála de ${usage > 1 ? "los productos" : "el producto"} antes de borrarla.`
          });
          return;
        }
        await media.remove(name);
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

const adminDirectory = path.join(__dirname, "admin");
const applyAdminPageHeaders = (_request, response, next) => {
  response.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  next();
};

module.exports = {
  adminDirectory,
  applyAdminPageHeaders,
  createAdminRouter
};
