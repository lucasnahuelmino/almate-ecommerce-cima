/* ==========================================================================
   admin.js — Núcleo del panel: sesión, navegación, pedidos y CSV
   --------------------------------------------------------------------------
   La gestión de productos vive en catalog.js. Este archivo expone los
   helpers compartidos (request, formato de fecha/precio) en window.AdminCore
   y avisa con el evento "admin:ready" cuando hay sesión iniciada.
   ========================================================================== */
(() => {
  "use strict";

  const loginPanel = document.querySelector("[data-login-panel]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginMessage = document.querySelector("[data-login-message]");
  const adminNav = document.querySelector("[data-admin-nav]");
  const ordersPanel = document.querySelector("[data-orders-panel]");
  const catalogPanel = document.querySelector("[data-catalog-panel]");
  const csvPanel = document.querySelector("[data-csv-panel]");
  const historyPanel = document.querySelector("[data-history-panel]");
  const navTabs = Array.from(document.querySelectorAll("[data-nav-tab]"));
  const csvForm = document.querySelector("[data-catalog-form]");
  const csvMessage = document.querySelector("[data-csv-message]");
  const ordersList = document.querySelector("[data-orders-list]");
  const ordersMessage = document.querySelector("[data-orders-message]");
  const ordersFilters = document.querySelector("[data-orders-filters]");
  const ordersSearch = document.querySelector("#orders-search");
  const ordersStatus = document.querySelector("#orders-status");
  const ordersFulfillment = document.querySelector("#orders-fulfillment");
  const ordersFrom = document.querySelector("#orders-from");
  const ordersTo = document.querySelector("#orders-to");
  const ordersClear = document.querySelector("[data-orders-clear]");
  const ordersCount = document.querySelector("[data-orders-count]");
  const ordersExport = document.querySelector("[data-orders-export]");
  const logoutButton = document.querySelector("[data-logout]");
  const refreshButton = document.querySelector("[data-refresh]");
  const loadMoreButton = document.querySelector("[data-load-more]");
  const pageSize = 50;
  const panelsBySection = {
    orders: ordersPanel,
    catalog: catalogPanel,
    history: historyPanel
  };
  const fulfillmentLabels = {
    awaiting_confirmation: "Pendiente de preparación",
    preparing: "Preparando",
    dispatched: "Despachado",
    delivered: "Entregado"
  };
  let csrfToken = "";
  let offset = 0;
  let searchTimer = null;
  let pendingCatalogCsv = "";
  let currentSection = "orders";

  const request = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", options.contentType || "application/json");
    }
    if (options.method && options.method !== "GET" && csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
      const error = new Error(result.error || "No se pudo completar la operación.");
      error.status = response.status;
      throw error;
    }
    return result;
  };

  const formatPrice = (amount) => new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(amount);

  const formatDate = (value) => new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

  const addText = (parent, tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text || "";
    parent.appendChild(element);
    return element;
  };

  /* ---------- Navegación por secciones ---------- */

  const showSection = (section) => {
    if (!panelsBySection[section]) return;
    currentSection = section;
    Object.entries(panelsBySection).forEach(([key, panel]) => {
      panel.hidden = key !== section;
    });
    // El CSV es una herramienta más del catálogo: se muestra con esa sección.
    csvPanel.hidden = section !== "catalog";
    navTabs.forEach((tab) => {
      if (tab.dataset.navTab === section) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (section === "orders") {
      loadOrders(false).catch((error) => {
        ordersMessage.textContent = error.message;
        ordersMessage.hidden = false;
      });
    } else {
      // catalog.js escucha este evento para cargar el listado la primera vez.
      window.dispatchEvent(new CustomEvent("admin:section", { detail: { section } }));
    }
  };

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => showSection(tab.dataset.navTab));
  });

  const showLogin = (text = "") => {
    loginPanel.hidden = false;
    adminNav.hidden = true;
    ordersPanel.hidden = true;
    catalogPanel.hidden = true;
    csvPanel.hidden = true;
    historyPanel.hidden = true;
    logoutButton.hidden = true;
    loginMessage.textContent = text;
    loginMessage.hidden = !text;
  };

  const showApp = () => {
    loginPanel.hidden = true;
    adminNav.hidden = false;
    logoutButton.hidden = false;
    showSection("orders");
    window.dispatchEvent(new CustomEvent("admin:ready"));
  };

  /* ---------- Pedidos ---------- */

  const nextStatuses = (current) => {
    const transitions = {
      awaiting_confirmation: ["preparing"],
      preparing: ["awaiting_confirmation", "dispatched"],
      dispatched: ["preparing", "delivered"],
      delivered: []
    };
    return transitions[current] || [];
  };

  const createOrderCard = (order) => {
    const card = document.createElement("article");
    card.className = "order-card";

    const header = document.createElement("header");
    header.className = "order-card__header";
    const orderIdentity = document.createElement("div");
    addText(orderIdentity, "strong", `Pedido ${order.orderId}`);
    addText(orderIdentity, "p", `Creado ${formatDate(order.createdAt)}`);
    const orderPayment = document.createElement("div");
    addText(orderPayment, "strong", formatPrice(order.total));
    addText(orderPayment, "p", `Pago: ${order.paymentStatus} · ${order.paymentMethod}`);
    if (order.paymentProvider === "whatsapp" && order.paymentStatus === "pending" && order.reservationExpiresAt) {
      addText(orderPayment, "p", `Reserva hasta ${formatDate(order.reservationExpiresAt)}`);
    }
    header.append(orderIdentity, orderPayment);

    const body = document.createElement("div");
    body.className = "order-card__body";
    const customer = document.createElement("section");
    addText(customer, "h3", "Cliente");
    addText(customer, "p", order.customer.name);
    addText(customer, "p", order.customer.email);
    addText(customer, "p", order.customer.phone);

    const shipping = document.createElement("section");
    addText(shipping, "h3", order.shipping.label || "Entrega");
    const address = [
      order.shipping.address,
      order.shipping.city,
      order.shipping.province,
      order.shipping.postalCode
    ].filter(Boolean).join(", ");
    addText(shipping, "p", address || "Sin dirección de entrega.");
    addText(shipping, "p", order.shipping.notes);

    const items = document.createElement("section");
    addText(items, "h3", "Productos");
    const itemList = document.createElement("ul");
    order.items.forEach((item) => {
      const variants = (item.variants || [])
        .map((variant) => `${variant.label}: ${variant.value}`)
        .join(", ");
      addText(itemList, "li", `${item.qty} × ${item.name}${variants ? ` (${variants})` : ""}`);
    });
    items.appendChild(itemList);
    body.append(customer, shipping, items);

    const actions = document.createElement("div");
    actions.className = "order-card__actions";
    const statusId = `fulfillment-${order.orderId}`;
    const label = document.createElement("label");
    label.htmlFor = statusId;
    label.textContent = "Preparación y entrega";
    const select = document.createElement("select");
    select.id = statusId;
    select.setAttribute("aria-label", `Estado operativo del pedido ${order.orderId}`);
    const currentStatus = document.createElement("option");
    currentStatus.value = order.fulfillmentStatus;
    currentStatus.textContent = fulfillmentLabels[order.fulfillmentStatus];
    select.appendChild(currentStatus);
    nextStatuses(order.fulfillmentStatus).forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = fulfillmentLabels[status];
      select.appendChild(option);
    });
    const saveButton = document.createElement("button");
    saveButton.className = "button button--secondary";
    saveButton.type = "button";
    saveButton.textContent = "Guardar estado";
    saveButton.disabled = order.paymentStatus !== "paid" || !nextStatuses(order.fulfillmentStatus).length;
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      try {
        await request(`/api/admin/orders/${encodeURIComponent(order.orderId)}/fulfillment`, {
          method: "PATCH",
          body: JSON.stringify({ status: select.value })
        });
        await loadOrders(false);
        ordersMessage.textContent = "Estado operativo actualizado.";
        ordersMessage.hidden = false;
      } catch (error) {
        ordersMessage.textContent = error.message;
        ordersMessage.hidden = false;
        saveButton.disabled = false;
      }
    });
    if (order.paymentStatus !== "paid") {
      addText(actions, "span", "El pedido solo se prepara cuando el pago está aprobado.");
    }
    actions.append(label, select, saveButton);
    if (order.paymentProvider === "whatsapp" && order.paymentStatus === "pending") {
      const releaseButton = document.createElement("button");
      releaseButton.className = "button button--secondary";
      releaseButton.type = "button";
      releaseButton.textContent = "Cancelar y liberar stock";
      releaseButton.addEventListener("click", async () => {
        releaseButton.disabled = true;
        try {
          await request(`/api/admin/orders/${encodeURIComponent(order.orderId)}/release-reservation`, {
            method: "POST"
          });
          await loadOrders(false);
          ordersMessage.textContent = "Pedido cancelado y reserva liberada.";
          ordersMessage.hidden = false;
        } catch (error) {
          ordersMessage.textContent = error.message;
          ordersMessage.hidden = false;
          releaseButton.disabled = false;
        }
      });
      actions.appendChild(releaseButton);
    }
    card.append(header, body, actions);
    return card;
  };

  /* ---------- Filtros del listado de pedidos ---------- */

  // Arma el query string con los filtros activos. Solo envía los que tienen valor.
  const currentOrderFilters = () => {
    const params = new URLSearchParams();
    const values = {
      q: ordersSearch.value.trim(),
      status: ordersStatus.value,
      fulfillment: ordersFulfillment.value,
      from: ordersFrom.value,
      to: ordersTo.value
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params;
  };

  const hasActiveOrderFilters = () => currentOrderFilters().toString() !== "";

  // El botón de exportar usa exactamente los filtros que se ven en pantalla.
  const syncOrdersExportLink = () => {
    const query = currentOrderFilters().toString();
    ordersExport.href = "/api/admin/orders.csv" + (query ? "?" + query : "");
  };

  const loadOrders = async (append) => {
    ordersMessage.hidden = true;
    if (!append) {
      offset = 0;
      ordersList.replaceChildren();
    }
    const params = currentOrderFilters();
    params.set("limit", pageSize);
    params.set("offset", offset);
    syncOrdersExportLink();
    const result = await request("/api/admin/orders?" + params.toString());
    result.orders.forEach((order) => ordersList.appendChild(createOrderCard(order)));
    offset += result.orders.length;
    const total = Number.isInteger(result.total) ? result.total : offset;
    loadMoreButton.hidden = offset >= total;
    if (total === 0 && !hasActiveOrderFilters()) {
      // Sin filtros y sin pedidos, el mensaje del listado alcanza.
      ordersCount.hidden = true;
    } else {
      ordersCount.hidden = false;
      ordersCount.textContent = total === 0
        ? "Sin resultados con estos filtros."
        : "Mostrando " + offset + " de " + total + (total === 1 ? " pedido." : " pedidos.");
    }
    if (!offset) {
      addText(
        ordersList,
        "p",
        hasActiveOrderFilters()
          ? "No hay pedidos que coincidan con los filtros."
          : "Todavía no hay pedidos registrados."
      );
    }
  };

  // Vuelve a pedir la primera página con los filtros actuales.
  const refreshOrders = () => {
    loadOrders(false).catch((error) => {
      ordersMessage.textContent = error.message;
      ordersMessage.hidden = false;
    });
  };

  const resumeSession = async () => {
    try {
      const session = await request("/api/admin/session");
      csrfToken = session.csrfToken;
      showApp();
    } catch (error) {
      showLogin(error.status === 401 ? "" : error.message);
    }
  };

  /* ---------- Eventos ---------- */

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: loginForm.elements.password.value })
      });
      csrfToken = result.csrfToken;
      loginForm.reset();
      showApp();
    } catch (error) {
      loginMessage.textContent = error.message;
      loginMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await request("/api/admin/logout", { method: "POST" });
      csrfToken = "";
      showLogin();
    } catch (error) {
      ordersMessage.textContent = error.message;
      ordersMessage.hidden = false;
    } finally {
      if (!csrfToken) loginForm.elements.password.focus();
    }
  });

  refreshButton.addEventListener("click", refreshOrders);

  loadMoreButton.addEventListener("click", () => {
    loadOrders(true).catch((error) => {
      ordersMessage.textContent = error.message;
      ordersMessage.hidden = false;
    });
  });

  // Submit del formulario: Enter en el buscador o cambio de fecha aplicado con Enter.
  ordersFilters.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(searchTimer);
    refreshOrders();
  });

  // La búsqueda espera 300 ms para no consultar en cada tecla.
  ordersSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshOrders, 300);
  });

  [ordersStatus, ordersFulfillment, ordersFrom, ordersTo].forEach((field) => {
    field.addEventListener("change", refreshOrders);
  });

  ordersClear.addEventListener("click", () => {
    clearTimeout(searchTimer);
    ordersFilters.reset();
    refreshOrders();
    ordersSearch.focus();
  });

  // Descarga el CSV sin salir del panel: si el servidor devuelve un error
  // (sesión vencida, demasiados pedidos), se muestra el mensaje en pantalla.
  let exportingOrders = false;
  ordersExport.addEventListener("click", async (event) => {
    event.preventDefault();
    if (exportingOrders) return;
    exportingOrders = true;
    ordersMessage.hidden = true;
    try {
      const response = await fetch(ordersExport.href, {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!response.ok) {
        let message = "No se pudo exportar el CSV.";
        try {
          const body = await response.json();
          if (body && body.error) message = body.error;
        } catch {
          // La respuesta no era JSON: se usa el mensaje genérico.
        }
        throw new Error(message);
      }
      const disposition = response.headers.get("content-disposition") || "";
      const nameMatch = /filename="?([^";]+)"?/.exec(disposition);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nameMatch ? nameMatch[1] : "cima-pedidos.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      ordersMessage.textContent = error.message;
      ordersMessage.hidden = false;
    } finally {
      exportingOrders = false;
    }
  });

  csvForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = csvForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    csvMessage.hidden = true;
    try {
      if (pendingCatalogCsv) {
        const result = await request("/api/admin/catalog/import", {
          method: "POST",
          body: pendingCatalogCsv,
          contentType: "text/csv"
        });
        csvMessage.textContent = `Importación aplicada: ${result.result.added} productos nuevos y ${result.result.updated} actualizados.`;
        pendingCatalogCsv = "";
        submitButton.textContent = "Validar e importar";
        // El catálogo cambió por CSV: pedimos que se recargue la lista.
        window.dispatchEvent(new CustomEvent("admin:catalog-changed"));
      } else {
        const file = csvForm.elements.catalog.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) throw new Error("El CSV supera el límite de 2 MB.");
        pendingCatalogCsv = await file.text();
        const preview = await request("/api/admin/catalog/preview", {
          method: "POST",
          body: pendingCatalogCsv,
          contentType: "text/csv"
        });
        const result = preview.result;
        const names = result.products.map((product) => `${product.name} (${product.sku})`).join(", ");
        csvMessage.textContent = `CSV válido: ${result.total} productos; ${result.added} nuevos y ${result.updated} actualizados.${names ? ` Muestra: ${names}${result.total > result.products.length ? ", …" : ""}.` : ""} Presioná de nuevo para confirmar.`;
        submitButton.textContent = "Confirmar importación";
      }
      csvMessage.hidden = false;
    } catch (error) {
      pendingCatalogCsv = "";
      submitButton.textContent = "Validar e importar";
      csvMessage.textContent = error.message;
      csvMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  csvForm.elements.catalog.addEventListener("change", () => {
    pendingCatalogCsv = "";
    csvForm.querySelector('button[type="submit"]').textContent = "Validar e importar";
    csvMessage.hidden = true;
  });

  /* ---------- Helpers compartidos con catalog.js ---------- */

  window.AdminCore = {
    request,
    addText,
    formatPrice,
    formatDate,
    get csrfToken() { return csrfToken; },
    get currentSection() { return currentSection; }
  };

  resumeSession();
})();
