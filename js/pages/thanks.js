/* ==========================================================================
   thanks.js — Comprobante y estado del pago informado por el servidor
   ========================================================================== */

(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const config = window.STORE_CONFIG || {};
  const providerId = config.payments && config.payments.provider || "whatsapp";
  const paymentProvider = window.PaymentProvider.get(providerId);
  const result = paymentProvider.handleReturn(params);
  const content = document.querySelector("[data-thanks-content]");
  const notFound = document.querySelector("[data-thanks-not-found]");
  const itemsElement = document.querySelector("[data-thanks-items]");
  const shippingElement = document.querySelector("[data-thanks-shipping]");
  const totalElement = document.querySelector("[data-thanks-total]");
  const paymentElement = document.querySelector("[data-thanks-payment]");
  const orderNumber = document.querySelector("[data-thanks-order]");
  const errorElement = document.querySelector("[data-thanks-error]");
  const statusElement = document.querySelector("[data-thanks-status]");
  const isMercadoPago = providerId === "mercadopago";

  const renderOrder = (order) => {
    content.hidden = false;
    notFound.hidden = true;
    orderNumber.textContent = order.orderId;
    shippingElement.textContent = order.shipping.method === "pickup"
      ? order.shipping.label
      : order.shipping.label + " — " + window.Utils.formatPrice(order.shipping.cost);
    paymentElement.textContent = isMercadoPago
      ? "Mercado Pago (prueba)"
      : order.payment.method === "transfer"
        ? "Transferencia a coordinar; los datos se confirman por WhatsApp."
        : "A coordinar por WhatsApp.";
    totalElement.textContent = window.Utils.formatPrice(order.total || order.totals.total);
    itemsElement.replaceChildren();
    order.items.forEach((item) => {
      const row = document.createElement("li");
      const variants = item.variants.map((variant) => variant.label + ": " + variant.value).join(" · ");
      const name = document.createElement("span");
      name.textContent = item.name + (variants ? " (" + variants + ")" : "") + " × " + item.qty;
      const price = document.createElement("strong");
      price.textContent = window.Utils.formatPrice(item.unitPrice * item.qty);
      row.append(name, price);
      itemsElement.appendChild(row);
    });
  };

  const showPaymentStatus = (status) => {
    if (!isMercadoPago) return;
    if (status === "paid") {
      statusElement.textContent = "Pago aprobado en Mercado Pago (TEST). Este resultado no confirma una compra real.";
      return;
    }
    if (status === "failed") {
      statusElement.textContent = "El pago no fue aprobado. Podés volver a la tienda e iniciar un nuevo pedido.";
      return;
    }
    statusElement.textContent = "Pago pendiente de confirmación. No inicies otro pago mientras se actualiza el estado.";
  };

  const loadOrder = async () => {
    let order = null;
    try {
      order = result.orderId ? window.Orders.getById(result.orderId) : null;
    } catch (error) {
      console.error("No se pudo cargar el comprobante local.", error);
      if (!isMercadoPago) {
        errorElement.textContent = error.message;
        errorElement.hidden = false;
        return;
      }
    }

    if (order) renderOrder(order);
    else if (!isMercadoPago) {
      content.hidden = true;
      notFound.hidden = false;
      return;
    }

    if (!isMercadoPago) return;
    const apiBaseUrl = config.payments && config.payments.apiBaseUrl;
    if (!apiBaseUrl || !result.orderId) {
      statusElement.textContent = "El pago se realizó en el entorno de prueba. Configurá la API para consultar el estado confirmado.";
      return;
    }

    try {
      const response = await window.fetch(
        apiBaseUrl.replace(/\/+$/, "") + "/api/orders/" + encodeURIComponent(result.orderId)
      );
      const data = await response.json();
      if (!response.ok || !data.order) {
        throw new Error(data.error || "No pudimos consultar el estado del pedido.");
      }
      renderOrder(data.order);
      showPaymentStatus(data.order.status);
    } catch (error) {
      console.error("No se pudo consultar el estado del pedido en el servidor.", error);
      showPaymentStatus("pending");
      errorElement.textContent = error.message || "No se pudo consultar el pago; volvé a intentar más tarde.";
      errorElement.hidden = false;
    }
  };

  loadOrder();
})();
