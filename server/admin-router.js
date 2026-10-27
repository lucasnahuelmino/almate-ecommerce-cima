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
const { applyBulkOperation, previewBulkOperation } = require("./services/bulk-ops");
const {
  analyzeCatalogImport,
  applyCatalogImport,
  buildFriendlyTemplate,
  exportCatalogFriendly
} = require("./services/catalog-import-enhanced");
const { createDatabaseBackup } = require("./services/backup");
const {
  listAdminAudit,
  recordAdminAudit,
  revertAdminAudit
} = require("./services/audit");

const privateOrderFields = (request, response, next) => {
  response.set({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  next();
};

const createAdminRouter = ({
  database,
  adminAuth,
  mediaDirectory = null,
  // null = no escribe respaldos en disco (pruebas herméticas).
  backupDirectory = null
}) => {
  const router = express.Router();
  const media = mediaDirectory ? createMediaService({ directory: mediaDirectory }) : null;

  /* ---------- Auditoría y respaldos (Etapa 5) ---------- */

  /**
   * Crea un respaldo verificable y lo registra en el historial.
   * Si el respaldo falla, LANZA: la operación de riesgo NO se ejecuta sin
   * respaldo previo.
   */
  const backupBefore = async (reason) => {
    const backup = await createDatabaseBackup(database, { directory: backupDirectory, reason });
    if (backup) {
      recordAdminAudit(database, {
        action: "backup.create",
        entity: "database",
        detail: { reason, file: backup.file, bytes: backup.bytes }
      });
    }
    return backup;
  };

  /** Registra un intento fallido en el historial (nunca relanza). */
  const auditFailure = (action, entity, entityId, error) => {
    recordAdminAudit(database, {
      action,
      entity,
      entityId: String(entityId || ""),
      result: "error",
      detail: { error: error.message || "Error desconocido" }
    });
  };

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
    async (request, response, next) => {
      if (typeof request.body !== "string") {
        response.status(400).json({ error: "Enviá el archivo como texto CSV." });
        return;
      }
      const isImport = request.path === "/catalog/import";
      try {
        // Antes de escribir (solo en la importación real): respaldo verificable.
        // Si el respaldo falla, la importación NO corre.
        const backup = isImport ? await backupBefore("catalog-import") : null;
        const result = isImport
          ? importCatalogCsv(database, request.body)
          : previewCatalogCsv(database, request.body);
        if (isImport) {
          recordAdminAudit(database, {
            action: "catalog.import",
            entity: "database",
            detail: { added: result.added, updated: result.updated, backup: backup?.file || "" }
          });
        }
        response.json({ result });
      } catch (error) {
        if (isImport) auditFailure("catalog.import", "database", "", error);
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
        auditFailure("product.create", "product", "", error);
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
        auditFailure("product.update", "product", request.params.id, error);
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
        auditFailure("product.duplicate", "product", request.params.id, error);
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
        auditFailure("product.archive", "product", request.params.id, error);
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
        auditFailure("product.delete", "product", request.params.id, error);
        next(error);
      }
    }
  );

  /* ---------- Operaciones masivas (Etapa 3) ---------- */

  // Vista previa y aplicación: el servidor calcula todo; el navegador solo
  // manda alcance (ids o categoría) y operación. La vista previa no escribe.
  router.post(
    "/catalog/bulk/preview",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      try {
        response.json(previewBulkOperation(database, request.body));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/catalog/bulk/apply",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    async (request, response, next) => {
      try {
        // Respaldo verificable antes de aplicar el cambio masivo.
        const backup = await backupBefore("catalog-bulk");
        const result = applyBulkOperation(database, request.body);
        // Para revertir después: solo las filas que realmente cambiaron
        // y solo precio/stock (lo mismo que el registro guardó).
        const revertChanges = result.rows
          .filter((row) => row.status === "change" && (result.field === "price" || result.field === "stock"))
          .map((row) => ({
            productId: row.id,
            name: row.name,
            sku: row.sku,
            field: result.field,
            before: row.current,
            after: row.next
          }));
        recordAdminAudit(database, {
          action: "catalog.bulk",
          entity: "product",
          detail: {
            field: result.field,
            description: result.description,
            summary: result.summary,
            backup: backup?.file || "",
            revertChanges
          }
        });
        response.json(result);
      } catch (error) {
        auditFailure("catalog.bulk", "product", "", error);
        next(error);
      }
    }
  );

  /* ---------- Importación amigable (Etapa 4) ---------- */

  // Descarga .xlsx (plantilla con instrucciones y catálogo actual editable).
  const sendWorkbook = async (build, filename, response, next) => {
    try {
      const buffer = await build();
      response.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      });
      response.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  router.get("/catalog/template.xlsx", requireSession, (request, response, next) => {
    void sendWorkbook(buildFriendlyTemplate, "plantilla-productos-cima.xlsx", response, next);
  });

  router.get("/catalog/friendly.xlsx", requireSession, (request, response, next) => {
    void sendWorkbook(
      () => exportCatalogFriendly(database),
      "catalogo-cima.xlsx",
      response,
      next
    );
  });

  // El archivo viaja como cuerpo binario crudo, igual que las imágenes:
  // primero se analiza sin escribir y después se aplica en una transacción.
  const friendlyImportBody = express.raw({ type: "application/octet-stream", limit: "10mb" });

  router.post(
    "/catalog/enhanced/analyze",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    friendlyImportBody,
    async (request, response, next) => {
      try {
        response.json(await analyzeCatalogImport(database, request.body));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/catalog/enhanced/apply",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    friendlyImportBody,
    async (request, response, next) => {
      try {
        // Respaldo verificable antes de escribir (si falla, no se importa).
        const backup = await backupBefore("catalog-import-enhanced");
        const result = await applyCatalogImport(database, request.body);
        recordAdminAudit(database, {
          action: "catalog.import.enhanced",
          entity: "database",
          detail: {
            applied: result.applied || {},
            summary: result.summary || {},
            backup: backup?.file || ""
          }
        });
        response.json(result);
      } catch (error) {
        auditFailure("catalog.import.enhanced", "database", "", error);
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
        recordAdminAudit(database, {
          action: "media.upload",
          entity: "media",
          entityId: result.name,
          detail: { name: result.name, size: result.size }
        });
        response.status(201).json({ media: result });
      } catch (error) {
        auditFailure("media.upload", "media", "", error);
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
        recordAdminAudit(database, {
          action: "media.delete",
          entity: "media",
          entityId: name,
          detail: { name }
        });
        response.status(204).end();
      } catch (error) {
        auditFailure("media.delete", "media", request.params.name, error);
        next(error);
      }
    }
  );

  /* ---------- Historial (Etapa 5) ---------- */

  // Listado paginado del historial (solo sesión iniciada; es solo lectura).
  router.get("/audit", requireSession, (request, response, next) => {
    try {
      response.json(listAdminAudit(database, request.query));
    } catch (error) {
      next(error);
    }
  });

  // Reversión de precio/stock de una entrada (sesión + origen + CSRF).
  router.post(
    "/audit/:id/revert",
    requireSameOrigin,
    requireSession,
    requireCsrf,
    (request, response, next) => {
      const id = Number(request.params.id);
      if (!Number.isSafeInteger(id) || id < 1) {
        response.status(404).json({ error: "Registro de historial no encontrado." });
        return;
      }
      try {
        response.json(revertAdminAudit(database, id));
      } catch (error) {
        auditFailure("audit.revert", "database", String(id), error);
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
