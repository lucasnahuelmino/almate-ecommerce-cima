const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const {
  validateProductLists,
  validateProductTexts
} = require("./services/product-rules");
const { normalizeText, toLikePattern } = require("./services/order-filters");

const schema = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    sku TEXT NOT NULL UNIQUE,
    category_id TEXT NOT NULL,
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE INDEX IF NOT EXISTS products_active_order
    ON products (active, sort_order);

  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    payment_id TEXT UNIQUE,
    preference_id TEXT,
    total INTEGER NOT NULL CHECK (total >= 0),
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory_reservations (
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    expires_at TEXT NOT NULL,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS payment_events (
    payment_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    received_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );

  CREATE TABLE IF NOT EXISTS order_fulfillment (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN (
      'awaiting_confirmation', 'preparing', 'dispatched', 'delivered'
    )),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );

  CREATE TABLE IF NOT EXISTS order_audit (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL,
    previous_status TEXT NOT NULL,
    next_status TEXT NOT NULL CHECK (next_status IN (
      'awaiting_confirmation', 'preparing', 'dispatched', 'delivered'
    )),
    changed_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );

  CREATE TABLE IF NOT EXISTS email_notifications (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL,
    event TEXT NOT NULL CHECK (event IN ('seller_request', 'seller_payment_approved', 'customer_payment_approved')),
    status TEXT NOT NULL CHECK (status IN ('disabled', 'queued')),
    created_at TEXT NOT NULL,
    UNIQUE (order_id, event),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );

  CREATE TABLE IF NOT EXISTS order_admin_events (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL,
    event TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );

  CREATE INDEX IF NOT EXISTS inventory_reservations_expiry
    ON inventory_reservations (expires_at);
  CREATE INDEX IF NOT EXISTS orders_created_at
    ON orders (created_at DESC);
  CREATE INDEX IF NOT EXISTS order_audit_order_id
    ON order_audit (order_id, changed_at DESC);

  -- Auditoría de acciones del panel (Etapa 5). Creación incremental:
  -- en bases existentes se agrega sin tocar datos previos.
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT 'ok',
    detail TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS admin_audit_log_created_at
    ON admin_audit_log (created_at DESC);
`;

const openDatabase = (databasePath) => {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  // Búsqueda del panel sin acentos ni mayúsculas: se usa desde el filtro SQL.
  database.function("normalize_text", { deterministic: true }, (value) => normalizeText(value));
  database.exec(schema);
  return database;
};

const seedCatalog = (database, { categories, products }) => {
  const categoryIds = new Set(categories.map((category) => category.id));
  const seenProductIds = new Set();
  const seenSlugs = new Set();
  const seenSkus = new Set();

  products.forEach((product) => {
    if (!product.id || !product.slug || !product.sku || !categoryIds.has(product.category)) {
      throw new Error(`El producto "${product.name || product.id || "sin identificar"}" tiene datos incompletos o una categoría inexistente.`);
    }
    if (seenProductIds.has(product.id) || seenSlugs.has(product.slug) || seenSkus.has(product.sku)) {
      throw new Error(`El producto "${product.name}" duplica un id, slug o SKU del catálogo.`);
    }
    seenProductIds.add(product.id);
    seenSlugs.add(product.slug);
    seenSkus.add(product.sku);
  });

  const replaceCatalog = database.transaction(() => {
    const insertCategory = database.prepare(
      `INSERT INTO categories (id, slug, sort_order, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         sort_order = excluded.sort_order,
         data = excluded.data`
    );
    categories.forEach((category) => {
      insertCategory.run(
        category.id,
        category.slug,
        Number(category.order) || 0,
        JSON.stringify(category)
      );
    });

    const insertProduct = database.prepare(
      `INSERT INTO products (id, slug, sku, category_id, active, sort_order, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`
    );
    products.forEach((product, index) => {
      insertProduct.run(
        product.id,
        product.slug,
        product.sku,
        product.category,
        product.active ? 1 : 0,
        index,
        JSON.stringify(product)
      );
    });
  });

  replaceCatalog();
};

const availableStock = (database, productId, now = new Date().toISOString()) => {
  const row = database.prepare(
    `SELECT p.data,
      COALESCE((SELECT SUM(m.quantity) FROM inventory_movements m WHERE m.product_id = p.id), 0) AS sold,
      COALESCE((SELECT SUM(r.quantity) FROM inventory_reservations r
        WHERE r.product_id = p.id AND r.expires_at > ?), 0) AS reserved
     FROM products p WHERE p.id = ? AND p.active = 1`
  ).get(now, productId);
  if (!row) return null;
  const product = JSON.parse(row.data);
  return Math.max(0, Number(product.stock) - row.sold - row.reserved);
};

const withAvailableStock = (database, row, now) => {
  const product = JSON.parse(row.data);
  product.stock = availableStock(database, product.id, now);
  return product;
};

const listCategories = (database) => database.prepare(
  "SELECT data FROM categories ORDER BY sort_order, id"
).all().map((row) => JSON.parse(row.data));

const listProducts = (database, now) => database.prepare(
  "SELECT data FROM products WHERE active = 1 ORDER BY sort_order, id"
).all().map((row) => withAvailableStock(database, row, now));

const getProductBySlug = (database, slug, now) => {
  const row = database.prepare(
    "SELECT data FROM products WHERE slug = ? AND active = 1"
  ).get(slug);
  return row ? withAvailableStock(database, row, now) : null;
};

const createPendingOrder = (database, order, reservationExpiry) => {
  const create = database.transaction(() => {
    database.prepare(
      `UPDATE orders SET status = 'failed', updated_at = ?
       WHERE status = 'pending' AND order_id IN (
         SELECT order_id FROM inventory_reservations WHERE expires_at <= ?
       )`
    ).run(order.createdAt, order.createdAt);
    database.prepare("DELETE FROM inventory_reservations WHERE expires_at <= ?")
      .run(order.createdAt);
    const requiredByProduct = new Map();
    order.items.forEach((item) => {
      requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) || 0) + item.qty);
    });
    requiredByProduct.forEach((quantity, productId) => {
      const stock = availableStock(database, productId, order.createdAt);
      if (stock == null) throw Object.assign(new Error("Uno de los productos ya no está disponible."), { status: 409 });
      if (stock < quantity) {
        throw Object.assign(new Error("No hay stock suficiente para completar el pedido."), { status: 409 });
      }
    });

    database.prepare(
      "INSERT INTO orders (order_id, status, total, data, created_at, updated_at) VALUES (?, 'pending', ?, ?, ?, ?)"
    ).run(order.orderId, order.totals.total, JSON.stringify(order), order.createdAt, order.createdAt);
    const reserve = database.prepare(
      "INSERT INTO inventory_reservations (order_id, product_id, quantity, expires_at) VALUES (?, ?, ?, ?)"
    );
    requiredByProduct.forEach((quantity, productId) => {
      reserve.run(order.orderId, productId, quantity, reservationExpiry);
    });
    if (order.payment && order.payment.provider === "whatsapp") {
      database.prepare(
        "INSERT OR IGNORE INTO email_notifications (order_id, event, status, created_at) VALUES (?, 'seller_request', 'disabled', ?)"
      ).run(order.orderId, order.createdAt);
    }
  });
  create();
};

const setPreferenceId = (database, orderId, preferenceId) => {
  const result = database.prepare(
    "UPDATE orders SET preference_id = ?, updated_at = ? WHERE order_id = ? AND status = 'pending'"
  ).run(preferenceId, new Date().toISOString(), orderId);
  return result.changes === 1;
};

const failPendingOrder = (database, orderId) => {
  const fail = database.transaction(() => {
    database.prepare(
      "UPDATE orders SET status = 'failed', updated_at = ? WHERE order_id = ? AND status = 'pending'"
    ).run(new Date().toISOString(), orderId);
    database.prepare("DELETE FROM inventory_reservations WHERE order_id = ?").run(orderId);
  });
  fail();
};

const getOrder = (database, orderId) => {
  const row = database.prepare(
    "SELECT order_id, status, payment_id, total, data, created_at FROM orders WHERE order_id = ?"
  ).get(orderId);
  return row ? { ...row, data: JSON.parse(row.data) } : null;
};

const applyPayment = (database, payment) => {
  const apply = database.transaction(() => {
    const order = getOrder(database, payment.external_reference);
    if (!order) throw Object.assign(new Error("El pedido asociado al pago no existe."), { status: 404 });
    if (payment.currency_id !== "ARS" || Number(payment.transaction_amount) !== order.total) {
      throw Object.assign(new Error("El pago no coincide con la moneda o el total del pedido."), { status: 409 });
    }

    const priorEvent = database.prepare(
      "SELECT status, order_id FROM payment_events WHERE payment_id = ?"
    ).get(String(payment.id));
    if (priorEvent && priorEvent.status === payment.status && priorEvent.order_id === order.order_id) {
      return { orderId: order.order_id, status: order.status, idempotent: true };
    }
    if (order.status === "paid") {
      if (order.payment_id === String(payment.id)) {
        return { orderId: order.order_id, status: "paid", idempotent: true };
      }
      throw Object.assign(new Error("El pedido ya fue pagado con otro pago."), { status: 409 });
    }

    const now = new Date().toISOString();
    database.prepare(
      `INSERT INTO payment_events (payment_id, order_id, status, received_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(payment_id) DO UPDATE SET status = excluded.status, received_at = excluded.received_at`
    ).run(String(payment.id), order.order_id, payment.status, now);

    if (payment.status === "approved") {
      const quantities = new Map();
      order.data.items.forEach((item) => {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty);
      });
      const ownReservations = database.prepare(
        "SELECT quantity FROM inventory_reservations WHERE order_id = ? AND product_id = ?"
      );
      const insertMovement = database.prepare(
        "INSERT INTO inventory_movements (order_id, product_id, quantity) VALUES (?, ?, ?)"
      );
      quantities.forEach((quantity, productId) => {
        const reservation = ownReservations.get(order.order_id, productId);
        const reserved = reservation ? reservation.quantity : 0;
        const remaining = availableStock(database, productId, now);
        if (remaining == null || remaining + reserved < quantity) {
          throw Object.assign(new Error("El stock cambió antes de confirmar el pago."), { status: 409 });
        }
        insertMovement.run(order.order_id, productId, quantity);
      });
      database.prepare(
        "UPDATE orders SET status = 'paid', payment_id = ?, updated_at = ? WHERE order_id = ?"
      ).run(String(payment.id), now, order.order_id);
      database.prepare("DELETE FROM inventory_reservations WHERE order_id = ?").run(order.order_id);
      database.prepare(
        "INSERT OR IGNORE INTO email_notifications (order_id, event, status, created_at) VALUES (?, ?, 'disabled', ?)"
      ).run(order.order_id, "seller_payment_approved", now);
      database.prepare(
        "INSERT OR IGNORE INTO email_notifications (order_id, event, status, created_at) VALUES (?, ?, 'disabled', ?)"
      ).run(order.order_id, "customer_payment_approved", now);
      return { orderId: order.order_id, status: "paid", idempotent: false };
    }

    if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
      database.prepare(
        "UPDATE orders SET status = 'failed', payment_id = ?, updated_at = ? WHERE order_id = ?"
      ).run(String(payment.id), now, order.order_id);
      database.prepare("DELETE FROM inventory_reservations WHERE order_id = ?").run(order.order_id);
      return { orderId: order.order_id, status: "failed", idempotent: false };
    }

    return { orderId: order.order_id, status: "pending", idempotent: false };
  });
  return apply();
};

const getPublicOrder = (database, orderId) => {
  const order = getOrder(database, orderId);
  if (!order) return null;
  return {
    orderId: order.order_id,
    status: order.status,
    total: order.total,
    currency: "ARS",
    createdAt: order.created_at,
    items: order.data.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      variants: item.variants
    })),
    shipping: {
      method: order.data.shipping.method,
      label: order.data.shipping.label,
      cost: order.data.shipping.cost
    }
  };
};

const fulfillmentTransitions = {
  awaiting_confirmation: ["preparing"],
  preparing: ["awaiting_confirmation", "dispatched"],
  dispatched: ["preparing", "delivered"],
  delivered: []
};

const mapAdminOrderRow = (row) => {
  const data = JSON.parse(row.data);
  return {
    orderId: row.order_id,
    paymentStatus: row.payment_status,
    paymentProvider: data.payment && data.payment.provider || "mercadopago",
    paymentMethod: data.payment && data.payment.method || "mercadopago",
    reservationExpiresAt: data.reservationExpiresAt || null,
    fulfillmentStatus: row.fulfillment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fulfillmentUpdatedAt: row.fulfillment_updated_at,
    total: row.total,
    items: data.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      variants: item.variants
    })),
    customer: {
      name: data.customer.name,
      email: data.customer.email,
      phone: data.customer.phone
    },
    shipping: {
      method: data.shipping.method,
      label: data.shipping.label,
      address: data.shipping.address,
      city: data.shipping.city,
      province: data.shipping.province,
      postalCode: data.shipping.postalCode,
      notes: data.shipping.notes
    }
  };
};

// Condiciones compartidas por el listado y el conteo del panel.
// Solo se agregan cláusulas con valores ya validados por parseOrderFilters.
const adminOrderConditions = (filters = {}) => {
  const clauses = [];
  const params = [];
  if (filters.status) {
    clauses.push("o.status = ?");
    params.push(filters.status);
  }
  if (filters.fulfillment) {
    clauses.push("COALESCE(f.status, 'awaiting_confirmation') = ?");
    params.push(filters.fulfillment);
  }
  if (filters.fromIso) {
    clauses.push("o.created_at >= ?");
    params.push(filters.fromIso);
  }
  if (filters.toIso) {
    clauses.push("o.created_at < ?");
    params.push(filters.toIso);
  }
  if (filters.q) {
    // Busca en pedido, nombre, email y teléfono. normalize_text quita acentos
    // y mayúsculas, y ESCAPE evita que % o _ se interpreten como comodines.
    const pattern = toLikePattern(filters.q);
    clauses.push(`(normalize_text(o.order_id) LIKE ? ESCAPE '\\'
      OR normalize_text(json_extract(o.data, '$.customer.name')) LIKE ? ESCAPE '\\'
      OR normalize_text(json_extract(o.data, '$.customer.email')) LIKE ? ESCAPE '\\'
      OR normalize_text(json_extract(o.data, '$.customer.phone')) LIKE ? ESCAPE '\\')`);
    params.push(pattern, pattern, pattern, pattern);
  }
  return { where: clauses.length ? " WHERE " + clauses.join(" AND ") : "", params };
};

const adminOrderSelect = `SELECT o.order_id, o.status AS payment_status, o.total, o.data,
    o.created_at, o.updated_at,
    COALESCE(f.status, 'awaiting_confirmation') AS fulfillment_status,
    COALESCE(f.updated_at, o.created_at) AS fulfillment_updated_at
  FROM orders o
  LEFT JOIN order_fulfillment f ON f.order_id = o.order_id`;

const listAdminOrders = (database, limit = 50, offset = 0, filters = {}) => {
  const { where, params } = adminOrderConditions(filters);
  return database.prepare(
    `${adminOrderSelect}${where}
     ORDER BY o.created_at DESC, o.order_id DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset).map(mapAdminOrderRow);
};

const countAdminOrders = (database, filters = {}) => {
  const { where, params } = adminOrderConditions(filters);
  return database.prepare(
    `SELECT COUNT(*) AS count
       FROM orders o
       LEFT JOIN order_fulfillment f ON f.order_id = o.order_id${where}`
  ).get(...params).count;
};

const updateOrderFulfillment = (database, orderId, nextStatus, now = new Date().toISOString()) => {
  if (!Object.hasOwn(fulfillmentTransitions, nextStatus)) {
    throw Object.assign(new Error("El estado operativo no es válido."), { status: 400 });
  }
  const update = database.transaction(() => {
    const row = database.prepare(
      `SELECT o.status AS payment_status,
          COALESCE(f.status, 'awaiting_confirmation') AS fulfillment_status
       FROM orders o LEFT JOIN order_fulfillment f ON f.order_id = o.order_id
       WHERE o.order_id = ?`
    ).get(orderId);
    if (!row) return null;
    if (row.payment_status !== "paid") {
      throw Object.assign(new Error("Solo se pueden preparar pedidos con pago aprobado."), { status: 409 });
    }
    if (row.fulfillment_status === nextStatus) {
      return { orderId, status: nextStatus, idempotent: true };
    }
    if (!fulfillmentTransitions[row.fulfillment_status].includes(nextStatus)) {
      throw Object.assign(new Error("No se permite ese cambio de estado operativo."), { status: 409 });
    }
    database.prepare(
      `INSERT INTO order_fulfillment (order_id, status, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(order_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
    ).run(orderId, nextStatus, now);
    database.prepare(
      "INSERT INTO order_audit (order_id, previous_status, next_status, changed_at) VALUES (?, ?, ?, ?)"
    ).run(orderId, row.fulfillment_status, nextStatus, now);
    return { orderId, status: nextStatus, idempotent: false };
  });
  return update();
};

const cancelWhatsappOrder = (database, orderId, now = new Date().toISOString()) => {
  const cancel = database.transaction(() => {
    const row = database.prepare("SELECT status, data FROM orders WHERE order_id = ?").get(orderId);
    if (!row) return null;
    const order = JSON.parse(row.data);
    if (!order.payment || order.payment.provider !== "whatsapp") {
      throw Object.assign(new Error("Solo se pueden liberar reservas de pedidos por WhatsApp."), { status: 409 });
    }
    if (row.status !== "pending") {
      throw Object.assign(new Error("El pedido ya no tiene una reserva pendiente."), { status: 409 });
    }
    database.prepare(
      "UPDATE orders SET status = 'failed', updated_at = ? WHERE order_id = ? AND status = 'pending'"
    ).run(now, orderId);
    database.prepare("DELETE FROM inventory_reservations WHERE order_id = ?").run(orderId);
    database.prepare(
      "INSERT INTO order_admin_events (order_id, event, changed_at) VALUES (?, 'whatsapp_reservation_released', ?)"
    ).run(orderId, now);
    return { orderId, status: "failed", idempotent: false };
  });
  return cancel();
};

const listCatalogProductsForAdmin = (database) => database.prepare(
  "SELECT id, slug, sku, category_id, active, sort_order, data FROM products ORDER BY sort_order, id"
).all().map((row) => {
  const product = JSON.parse(row.data);
  const sold = database.prepare(
    "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_movements WHERE product_id = ?"
  ).get(row.id).quantity;
  return {
    ...product,
    active: Boolean(row.active),
    stock: Math.max(0, Number(product.stock) - sold)
  };
});

const validateCatalogProducts = (database, products) => {
  const existing = new Map(database.prepare("SELECT id, sku, slug FROM products").all()
    .flatMap((row) => [[row.id, row], [row.sku, row]]));
  const existingBySlug = new Map(database.prepare("SELECT id, slug FROM products").all()
    .map((row) => [row.slug, row.id]));
  const ids = new Set();
  const skus = new Set();
  const slugs = new Set();
  let added = 0;
  let updated = 0;
  products.forEach((product) => {
    if (ids.has(product.id) || skus.has(product.sku) || slugs.has(product.slug)) {
      throw Object.assign(new Error(`El CSV duplica el ID, slug o SKU "${product.sku}".`), { status: 400 });
    }
    ids.add(product.id);
    skus.add(product.sku);
    slugs.add(product.slug);
    const old = existing.get(product.id);
    const oldSku = existing.get(product.sku);
    const slugOwner = existingBySlug.get(product.slug);
    if ((old && old.sku !== product.sku) || (oldSku && oldSku.id !== product.id) ||
        (slugOwner && slugOwner !== product.id)) {
      throw Object.assign(new Error(`El ID, slug o SKU de "${product.name}" ya pertenece a otro producto.`), { status: 409 });
    }
    if (!database.prepare("SELECT 1 FROM categories WHERE id = ?").get(product.category)) {
      throw Object.assign(new Error(`La categoría "${product.category}" no existe.`), { status: 400 });
    }
    const reserved = old
      ? database.prepare(
        "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_reservations WHERE product_id = ? AND expires_at > ?"
      ).get(product.id, new Date().toISOString()).quantity
      : 0;
    if (product.stock < reserved) {
      throw Object.assign(new Error(`El stock de "${product.name}" no puede ser menor que las unidades reservadas (${reserved}).`), { status: 409 });
    }
    validateProductLists(product);
    validateProductTexts(product);
    if (old) updated += 1;
    else added += 1;
  });
  return { added, updated };
};

const importCatalogProducts = (database, products) => {
  const importProducts = database.transaction(() => {
    const { added, updated } = validateCatalogProducts(database, products);
    const upsert = database.prepare(
      `INSERT INTO products (id, slug, sku, category_id, active, sort_order, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         sku = excluded.sku,
         category_id = excluded.category_id,
         active = excluded.active,
         sort_order = excluded.sort_order,
         data = excluded.data`
    );
    products.forEach((product, index) => {
      const existing = database.prepare("SELECT data FROM products WHERE id = ?").get(product.id);
      const oldData = existing ? JSON.parse(existing.data) : {};
      const sold = existing
        ? database.prepare(
          "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_movements WHERE product_id = ?"
        ).get(product.id).quantity
        : 0;
      const next = { ...oldData, ...product, stock: product.stock + sold };
      upsert.run(next.id, next.slug, next.sku, next.category, next.active ? 1 : 0, index, JSON.stringify(next));
    });
    return { added, updated };
  });
  return importProducts();
};

/* ==========================================================================
   Gestión individual de productos (panel de administración)
   --------------------------------------------------------------------------
   Semántica de stock (igual que en la importación CSV):
   • data.stock  = stock físico TOTAL (incluye vendido y reservado).
   • vendido     = suma de inventory_movements.
   • reservado   = suma de inventory_reservations activas.
   • La panel muestra y edita "stock disponible de góndola" = data.stock − vendido.
   Al guardar, se persiste data.stock = valorRecibido + vendido.
   ========================================================================== */

const adminProductQuery = `
  SELECT p.id, p.slug, p.sku, p.category_id, p.active, p.sort_order, p.data,
    COALESCE((SELECT SUM(m.quantity) FROM inventory_movements m WHERE m.product_id = p.id), 0) AS sold,
    COALESCE((SELECT SUM(r.quantity) FROM inventory_reservations r
      WHERE r.product_id = p.id AND r.expires_at > ?), 0) AS reserved
  FROM products p`;

const rowToAdminProduct = (row) => {
  const product = JSON.parse(row.data);
  const stockOnHand = Math.max(0, Number(product.stock) - row.sold);
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: product.name,
    category: row.category_id,
    subcategory: product.subcategory || "",
    price: product.price,
    comparePrice: product.comparePrice == null ? null : product.comparePrice,
    stock: stockOnHand,
    sold: row.sold,
    reserved: row.reserved,
    active: Boolean(row.active),
    featured: Boolean(product.featured),
    tags: Array.isArray(product.tags) ? product.tags : [],
    images: Array.isArray(product.images) ? product.images : [],
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    specs: Array.isArray(product.specs) ? product.specs : [],
    variants: Array.isArray(product.variants) ? product.variants : [],
    createdAt: product.createdAt,
    sortOrder: row.sort_order
  };
};

/** Lista paginada con filtros, orden y búsqueda para el panel. */
const listCatalogProductsAdminPaged = (database, filters, now = new Date().toISOString()) => {
  const {
    search = "",
    category = "",
    active = null,
    featured = null,
    stockFilter = "",
    minPrice = null,
    maxPrice = null,
    sort = "sortOrder",
    order = "asc",
    limit = 50,
    offset = 0
  } = filters;

  const conditions = [];
  const params = [now];
  if (search) {
    conditions.push("(LOWER(p.data LIKE ? OR p.sku LIKE ?))");
    const term = `%${String(search).toLowerCase()}%`;
    params.push(term, term);
  }
  if (category) {
    conditions.push("p.category_id = ?");
    params.push(category);
  }
  if (active !== null) {
    conditions.push("p.active = ?");
    params.push(active ? 1 : 0);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const rows = database.prepare(`${adminProductQuery}${where}`).all(...params)
    .map(rowToAdminProduct);

  let products = rows;
  if (featured !== null) products = products.filter((product) => product.featured === featured);
  if (stockFilter === "out") products = products.filter((product) => product.stock <= 0);
  if (stockFilter === "in") products = products.filter((product) => product.stock > 0);
  if (minPrice !== null) products = products.filter((product) => product.price >= minPrice);
  if (maxPrice !== null) products = products.filter((product) => product.price <= maxPrice);

  const direction = order === "desc" ? -1 : 1;
  const comparators = {
    name: (a, b) => a.name.localeCompare(b.name, "es"),
    price: (a, b) => a.price - b.price,
    stock: (a, b) => a.stock - b.stock,
    createdAt: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    sortOrder: (a, b) => a.sortOrder - b.sortOrder
  };
  const compare = comparators[sort] || comparators.sortOrder;
  products.sort((a, b) => direction * compare(a, b));

  const total = products.length;
  return {
    total,
    products: products.slice(offset, offset + limit)
  };
};

/** Un producto completo para el formulario del panel. */
const getProductForAdmin = (database, id, now = new Date().toISOString()) => {
  const row = database.prepare(`${adminProductQuery} WHERE p.id = ?`).get(now, id);
  return row ? rowToAdminProduct(row) : null;
};

/** Un producto por SKU (para crear duplicados o buscar desde formularios). */
const getProductBySkuForAdmin = (database, sku, now = new Date().toISOString()) => {
  const row = database.prepare(`${adminProductQuery} WHERE p.sku = ?`).get(now, sku);
  return row ? rowToAdminProduct(row) : null;
};

/** Cuenta cuántos productos hay, para saber el próximo sort_order. */
const nextProductSortOrder = (database) => {
  const row = database.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products").get();
  return row.next;
};

/**
 * Crea o actualiza un producto validado en una transacción.
 * `product` debe venir ya validado y con data.stock como total físico.
 * El JSON guardado conserva SOLO los campos del catálogo (sin sortOrder,
 * sold ni reserved, que son datos del panel y no del producto).
 */
const upsertProductRow = (database, product) => {
  const stored = {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    category: product.category,
    subcategory: product.subcategory || "",
    price: product.price,
    comparePrice: product.comparePrice == null ? null : product.comparePrice,
    stock: product.stock,
    images: product.images,
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    specs: product.specs,
    variants: product.variants,
    tags: product.tags,
    featured: Boolean(product.featured),
    active: Boolean(product.active),
    createdAt: product.createdAt
  };
  const upsert = database.transaction(() => {
    database.prepare(
      `INSERT INTO products (id, slug, sku, category_id, active, sort_order, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         sku = excluded.sku,
         category_id = excluded.category_id,
         active = excluded.active,
         sort_order = excluded.sort_order,
         data = excluded.data`
    ).run(
      product.id,
      product.slug,
      product.sku,
      product.category,
      product.active ? 1 : 0,
      product.sortOrder,
      JSON.stringify(stored)
    );
  });
  upsert();
};

/** Marca un producto como activo o inactivo (columna y JSON se mantienen iguales). */
const setCatalogProductActive = (database, id, active) => {
  const row = database.prepare("SELECT data FROM products WHERE id = ?").get(id);
  if (!row) return null;
  const product = JSON.parse(row.data);
  product.active = Boolean(active);
  database.transaction(() => {
    database.prepare("UPDATE products SET active = ?, data = ? WHERE id = ?")
      .run(active ? 1 : 0, JSON.stringify(product), id);
  })();
  return database.prepare("SELECT id FROM products WHERE id = ?").get(id);
};

/** Campos del JSON que se pueden modificar de forma puntual (operaciones masivas). */
const PATCHABLE_PRODUCT_FIELDS = new Set(["price", "comparePrice", "featured", "stock"]);

/**
 * Aplica cambios puntuales SOLO sobre campos permitidos del JSON data.
 * No toca imágenes, descripciones, variantes ni ningún otro campo.
 * `changes` viene ya validado desde bulk-ops.js (el validador es quien
 * decide qué valores son correctos; acá solo se aplica la lista blanca).
 * Devuelve false si el producto no existe.
 */
const patchProductData = (database, id, changes) => {
  const row = database.prepare("SELECT data FROM products WHERE id = ?").get(id);
  if (!row) return false;
  const product = JSON.parse(row.data);
  Object.entries(changes).forEach(([field, value]) => {
    if (!PATCHABLE_PRODUCT_FIELDS.has(field)) {
      throw Object.assign(
        new Error(`El campo "${field}" no se puede modificar de forma puntual.`),
        { status: 500 }
      );
    }
    product[field] = value;
  });
  database.prepare("UPDATE products SET data = ? WHERE id = ?").run(JSON.stringify(product), id);
  return true;
};

/** Devuelve qué identificadores (id, sku, slug) ya están tomados por OTRO producto. */
const catalogProductConflicts = (database, { id = "", sku = "", slug = "", excludeId = "" }) => {
  const row = database.prepare(
    `SELECT
       MAX(CASE WHEN id = ? AND id <> ? THEN 1 ELSE 0 END) AS id_taken,
       MAX(CASE WHEN sku = ? AND id <> ? THEN 1 ELSE 0 END) AS sku_taken,
       MAX(CASE WHEN slug = ? AND id <> ? THEN 1 ELSE 0 END) AS slug_taken
     FROM products`
  ).get(id, excludeId, sku, excludeId, slug, excludeId);
  return {
    idTaken: Boolean(row.id_taken),
    skuTaken: Boolean(row.sku_taken),
    slugTaken: Boolean(row.slug_taken)
  };
};

/** true si la categoría existe en el catálogo de categorías. */
const categoryExists = (database, categoryId) =>
  Boolean(database.prepare("SELECT 1 FROM categories WHERE id = ?").get(categoryId));

/**
 * Cuántos productos usan una imagen (por ruta exacta dentro del JSON data).
 * Se usa para no borrar imágenes subidas que siguen en uso.
 */
const catalogImageUsage = (database, imagePath) => {
  // Escapa los comodines LIKE; las rutas de imagen no deberían traerlos igual.
  const escaped = String(imagePath).replace(/[\\%_]/g, (char) => `\\${char}`);
  return database.prepare(
    "SELECT COUNT(*) AS count FROM products WHERE data LIKE ? ESCAPE '\\'"
  ).get(`%"${escaped}"%`).count;
};

/** Borra un producto SOLO si no tiene ventas ni reservas. */
const deleteProductForAdmin = (database, id) => {
  const sold = database.prepare(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = ?"
  ).get(id).count;
  const reserved = database.prepare(
    "SELECT COUNT(*) AS count FROM inventory_reservations WHERE product_id = ?"
  ).get(id).count;
  if (sold > 0 || reserved > 0) {
    throw Object.assign(
      new Error("Este producto tiene ventas o reservas registradas; desactivalo en lugar de borrarlo."),
      { status: 409 }
    );
  }
  const result = database.prepare("DELETE FROM products WHERE id = ?").run(id);
  return result.changes === 1;
};

module.exports = {
  openDatabase,
  seedCatalog,
  listCategories,
  listProducts,
  getProductBySlug,
  availableStock,
  createPendingOrder,
  setPreferenceId,
  failPendingOrder,
  applyPayment,
  getPublicOrder,
  listAdminOrders,
  countAdminOrders,
  updateOrderFulfillment,
  cancelWhatsappOrder,
  listCatalogProductsForAdmin,
  importCatalogProducts,
  validateCatalogProducts,
  listCatalogProductsAdminPaged,
  getProductForAdmin,
  getProductBySkuForAdmin,
  nextProductSortOrder,
  upsertProductRow,
  setCatalogProductActive,
  catalogProductConflicts,
  categoryExists,
  catalogImageUsage,
  patchProductData,
  deleteProductForAdmin
};
