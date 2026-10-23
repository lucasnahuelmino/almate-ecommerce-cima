/* ==========================================================================
   whatsapp.js — Proveedor de pedidos coordinados por WhatsApp
   ========================================================================== */

(function () {
  "use strict";

  const formatPrice = window.Utils.formatPrice;

  const createCheckout = async (order) => {
    const phone = window.STORE_CONFIG.contact.whatsapp;
    if (!phone) throw new Error("Falta configurar el número de WhatsApp de la tienda.");

    const itemLines = order.items.map((item) => {
      const variants = item.variants.map((variant) => variant.label + ": " + variant.value).join(", ");
      return "- " + item.name + (variants ? " (" + variants + ")" : "") +
        " — " + item.qty + " x " + formatPrice(item.unitPrice);
    });
    const shipping = order.shipping.method === "pickup"
      ? "Retiro: " + order.shipping.label
      : "Envío: " + order.shipping.label + " — " + formatPrice(order.shipping.cost);
    const payment = order.payment.method === "transfer"
      ? "Transferencia (solicito los datos para pagar)"
      : "A coordinar por WhatsApp";
    const message = [
      "Hola, quiero coordinar el pedido " + order.orderId + ":",
      "",
      ...itemLines,
      "",
      "Subtotal: " + formatPrice(order.totals.subtotal),
      order.totals.discount > 0 ? "Descuento por transferencia: -" + formatPrice(order.totals.discount) : "",
      shipping,
      "Total estimado: " + formatPrice(order.totals.total),
      "Forma de pago: " + payment,
      "",
      "Datos de contacto:",
      "Nombre: " + order.customer.name,
      "Email: " + order.customer.email,
      "Teléfono: " + order.customer.phone,
      "DNI: " + order.customer.dni,
      order.shipping.method === "delivery"
        ? "Entrega: " + [order.shipping.address, order.shipping.city, order.shipping.province, order.shipping.postalCode].filter(Boolean).join(", ")
        : "",
      order.shipping.notes ? "Indicaciones: " + order.shipping.notes : ""
    ].filter(Boolean).join("\n");

    return {
      type: "whatsapp",
      url: "https://wa.me/" + phone + "?text=" + encodeURIComponent(message),
      orderId: order.orderId
    };
  };

  window.PaymentProvider.register({
    id: "whatsapp",
    label: "WhatsApp",
    createCheckout,
    handleReturn: (params) => ({
      status: params.get("status") || "pending",
      orderId: params.get("order") || ""
    })
  });
})();
