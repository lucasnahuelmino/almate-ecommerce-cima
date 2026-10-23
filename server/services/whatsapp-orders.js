const { randomUUID } = require("node:crypto");
const { createPendingOrder } = require("../db");
const { CheckoutError, validateOrderRequest } = require("./catalog");

const createWhatsappOrderService = ({
  database,
  config,
  reservationMinutes = 30,
  now = () => new Date()
}) => {
  if (!database || !config) throw new Error("La base y la configuración son obligatorias.");
  if (!Number.isInteger(reservationMinutes) || reservationMinutes < 1 || reservationMinutes > 1440) {
    throw new Error("ORDER_RESERVATION_MINUTES debe ser un entero entre 1 y 1440.");
  }

  const createOrder = (input) => {
    const phone = config.contact && String(config.contact.whatsapp || "").replace(/\D/g, "");
    if (!phone) throw new CheckoutError("El WhatsApp de la tienda no está configurado.", 503);
    if (!input || !input.payment || input.payment.provider !== "whatsapp" ||
        !["whatsapp", "transfer"].includes(input.payment.method)) {
      throw new CheckoutError("El método de pago del pedido no es válido.");
    }

    const validated = validateOrderRequest(database, config, input);
    const created = now();
    const expiresAt = new Date(created.getTime() + reservationMinutes * 60 * 1000);
    const order = {
      orderId: randomUUID(),
      createdAt: created.toISOString(),
      status: "pending",
      items: validated.items,
      customer: validated.customer,
      shipping: validated.shipping,
      totals: validated.totals,
      payment: { provider: "whatsapp", method: input.payment.method, status: "pending" },
      reservationExpiresAt: expiresAt.toISOString()
    };
    const formatPrice = (amount) => new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(amount);
    const lines = order.items.map((item) => {
      const variants = item.variants.map((variant) => `${variant.label}: ${variant.value}`).join(", ");
      return `- ${item.name}${variants ? ` (${variants})` : ""} — ${item.qty} x ${formatPrice(item.unitPrice)}`;
    });
    const shippingText = order.shipping.method === "pickup"
      ? `Retiro: ${order.shipping.label}`
      : `Envío: ${order.shipping.label} — ${formatPrice(order.shipping.cost)}`;
    const paymentText = order.payment.method === "transfer"
      ? "Transferencia (solicito los datos para pagar)"
      : "A coordinar por WhatsApp";
    const message = [
      `Hola, quiero coordinar el pedido ${order.orderId}:`,
      "",
      ...lines,
      "",
      `Subtotal: ${formatPrice(order.totals.subtotal)}`,
      order.totals.discount ? `Descuento por transferencia: -${formatPrice(order.totals.discount)}` : "",
      shippingText,
      `Total estimado: ${formatPrice(order.totals.total)}`,
      `Forma de pago: ${paymentText}`,
      "",
      "Datos de contacto:",
      `Nombre: ${order.customer.name}`,
      `Email: ${order.customer.email}`,
      `Teléfono: ${order.customer.phone}`,
      `DNI: ${order.customer.dni}`,
      order.shipping.method === "delivery"
        ? `Entrega: ${[order.shipping.address, order.shipping.city, order.shipping.province, order.shipping.postalCode].filter(Boolean).join(", ")}`
        : "",
      order.shipping.notes ? `Indicaciones: ${order.shipping.notes}` : ""
    ].filter(Boolean).join("\n");
    createPendingOrder(database, order, expiresAt.toISOString());
    return {
      orderId: order.orderId,
      url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      items: order.items,
      totals: order.totals,
      reservationExpiresAt: order.reservationExpiresAt
    };
  };

  return { createOrder };
};

module.exports = { createWhatsappOrderService };
