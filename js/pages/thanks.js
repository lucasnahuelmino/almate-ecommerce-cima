/* ==========================================================================
   thanks.js — Comprobante local del pedido pendiente
   ========================================================================== */

(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const paymentProvider = window.PaymentProvider.get(window.STORE_CONFIG.payments.provider);
  const result = paymentProvider.handleReturn(params);
  const orderId = result.orderId;
  const content = document.querySelector("[data-thanks-content]");
  const notFound = document.querySelector("[data-thanks-not-found]");
  const itemsElement = document.querySelector("[data-thanks-items]");
  const shippingElement = document.querySelector("[data-thanks-shipping]");
  const totalElement = document.querySelector("[data-thanks-total]");
  const paymentElement = document.querySelector("[data-thanks-payment]");
  const orderNumber = document.querySelector("[data-thanks-order]");
  const errorElement = document.querySelector("[data-thanks-error]");

  let order;
  try {
    order = orderId ? window.Orders.getById(orderId) : null;
  } catch (error) {
    console.error("No se pudo cargar el comprobante del pedido.", error);
    errorElement.textContent = error.message;
    errorElement.hidden = false;
    content.hidden = false;
    notFound.hidden = true;
    return;
  }

  if (!order) {
    content.hidden = true;
    notFound.hidden = false;
    return;
  }

  content.hidden = false;
  orderNumber.textContent = order.orderId;
  shippingElement.textContent = order.shipping.method === "pickup"
    ? order.shipping.label
    : order.shipping.label + " — " + window.Utils.formatPrice(order.shipping.cost);
  paymentElement.textContent = order.payment.method === "transfer"
    ? "Transferencia a coordinar; los datos se confirman por WhatsApp."
    : "A coordinar por WhatsApp.";
  totalElement.textContent = window.Utils.formatPrice(order.totals.total);
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
})();
