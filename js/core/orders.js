/* ==========================================================================
   orders.js — Referencias y comprobantes sin datos personales
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "cima-orders-v1";

  const readOrders = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("No se pudieron leer los comprobantes guardados.", error);
      throw new Error("No pudimos acceder al historial de pedidos del navegador.");
    }
  };

  const savePending = (order) => {
    const receipt = {
      orderId: order.orderId,
      createdAt: order.createdAt,
      status: order.status,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        variants: item.variants.map((variant) => ({
          label: variant.label,
          value: variant.value
        }))
      })),
      shipping: {
        method: order.shipping.method,
        label: order.shipping.label,
        cost: order.shipping.cost
      },
      totals: { ...order.totals },
      payment: {
        provider: order.payment.provider,
        method: order.payment.method,
        status: order.payment.status
      }
    };
    const orders = readOrders().filter((entry) => !entry || entry.orderId !== receipt.orderId);
    orders.push(receipt);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(-20)));
    } catch (error) {
      console.error("No se pudo guardar el comprobante del pedido.", error);
      throw new Error("No pudimos guardar el comprobante. Revisá el espacio disponible del navegador e intentá de nuevo.");
    }
    return receipt;
  };

  const getById = (orderId) => {
    const order = readOrders().find((entry) => entry && entry.orderId === orderId);
    if (!order || !Array.isArray(order.items) || !order.items.length) return null;
    if (!order.items.every((item) =>
      item && typeof item.name === "string" &&
      Number.isInteger(item.qty) && item.qty > 0 &&
      Number.isFinite(item.unitPrice) && item.unitPrice >= 0 &&
      Array.isArray(item.variants) &&
      item.variants.every((variant) =>
        variant && typeof variant.label === "string" && typeof variant.value === "string")
    )) return null;
    if (!order.shipping || typeof order.shipping.label !== "string" ||
        !Number.isFinite(order.shipping.cost) || !order.totals ||
        !["subtotal", "discount", "shipping", "total"].every((key) =>
          Number.isFinite(order.totals[key]) && order.totals[key] >= 0) ||
        !order.payment || typeof order.payment.method !== "string") return null;
    return order;
  };

  window.Orders = { savePending, getById };
})();
