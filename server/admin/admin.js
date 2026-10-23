(() => {
  "use strict";

  const loginPanel = document.querySelector("[data-login-panel]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginMessage = document.querySelector("[data-login-message]");
  const ordersPanel = document.querySelector("[data-orders-panel]");
  const catalogForm = document.querySelector("[data-catalog-form]");
  const catalogMessage = document.querySelector("[data-catalog-message]");
  const ordersList = document.querySelector("[data-orders-list]");
  const ordersMessage = document.querySelector("[data-orders-message]");
  const logoutButton = document.querySelector("[data-logout]");
  const refreshButton = document.querySelector("[data-refresh]");
  const loadMoreButton = document.querySelector("[data-load-more]");
  const pageSize = 50;
  const fulfillmentLabels = {
    awaiting_confirmation: "Pendiente de preparación",
    preparing: "Preparando",
    dispatched: "Despachado",
    delivered: "Entregado"
  };
  let csrfToken = "";
  let offset = 0;
  let pendingCatalogCsv = "";

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

  const showLogin = (text = "") => {
    loginPanel.hidden = false;
    ordersPanel.hidden = true;
    logoutButton.hidden = true;
    loginMessage.textContent = text;
    loginMessage.hidden = !text;
  };

  const showOrders = () => {
    loginPanel.hidden = true;
    ordersPanel.hidden = false;
    logoutButton.hidden = false;
  };

  const addText = (parent, tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text || "";
    parent.appendChild(element);
    return element;
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

  const loadOrders = async (append) => {
    ordersMessage.hidden = true;
    if (!append) {
      offset = 0;
      ordersList.replaceChildren();
    }
    const result = await request(`/api/admin/orders?limit=${pageSize}&offset=${offset}`);
    result.orders.forEach((order) => ordersList.appendChild(createOrderCard(order)));
    offset += result.orders.length;
    loadMoreButton.hidden = result.orders.length < pageSize;
    if (!offset) addText(ordersList, "p", "Todavía no hay pedidos registrados.");
  };

  const resumeSession = async () => {
    try {
      const session = await request("/api/admin/session");
      csrfToken = session.csrfToken;
      showOrders();
      await loadOrders(false);
    } catch (error) {
      showLogin(error.status === 401 ? "" : error.message);
    }
  };

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
      showOrders();
      try {
        await loadOrders(false);
      } catch (error) {
        ordersMessage.textContent = error.message;
        ordersMessage.hidden = false;
      }
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

  refreshButton.addEventListener("click", () => {
    loadOrders(false).catch((error) => {
      ordersMessage.textContent = error.message;
      ordersMessage.hidden = false;
    });
  });

  loadMoreButton.addEventListener("click", () => {
    loadOrders(true).catch((error) => {
      ordersMessage.textContent = error.message;
      ordersMessage.hidden = false;
    });
  });

  catalogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = catalogForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    catalogMessage.hidden = true;
    try {
      if (pendingCatalogCsv) {
        const result = await request("/api/admin/catalog/import", {
          method: "POST",
          body: pendingCatalogCsv,
          contentType: "text/csv"
        });
        catalogMessage.textContent = `Importación aplicada: ${result.result.added} productos nuevos y ${result.result.updated} actualizados.`;
        pendingCatalogCsv = "";
        submitButton.textContent = "Validar e importar";
      } else {
        const file = catalogForm.elements.catalog.files[0];
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
        catalogMessage.textContent = `CSV válido: ${result.total} productos; ${result.added} nuevos y ${result.updated} actualizados.${names ? ` Muestra: ${names}${result.total > result.products.length ? ", …" : ""}.` : ""} Presioná de nuevo para confirmar.`;
        submitButton.textContent = "Confirmar importación";
      }
      catalogMessage.hidden = false;
    } catch (error) {
      pendingCatalogCsv = "";
      submitButton.textContent = "Validar e importar";
      catalogMessage.textContent = error.message;
      catalogMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  catalogForm.elements.catalog.addEventListener("change", () => {
    pendingCatalogCsv = "";
    catalogForm.querySelector('button[type="submit"]').textContent = "Validar e importar";
    catalogMessage.hidden = true;
  });

  resumeSession();
})();
