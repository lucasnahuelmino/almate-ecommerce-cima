/* ==========================================================================
   mercadopago.js — Checkout Pro de prueba, con preferencia creada en servidor
   ========================================================================== */

(function () {
  "use strict";

  const config = window.STORE_CONFIG || {};

  const createCheckout = async (order) => {
    const apiBaseUrl = config.payments && config.payments.apiBaseUrl;
    if (!apiBaseUrl) {
      throw new Error("Falta configurar la URL de la API para Mercado Pago.");
    }

    const response = await window.fetch(apiBaseUrl.replace(/\/+$/, "") + "/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: order.items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          variants: item.variants.map((variant) => ({
            id: variant.id,
            value: variant.value
          }))
        })),
        customer: order.customer,
        shipping: order.shipping
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "No se pudo iniciar el pago de prueba.");
    }
    if (!result.initPoint || !result.orderId || !result.totals || !Array.isArray(result.items)) {
      throw new Error("La API devolvió una respuesta de checkout incompleta.");
    }

    return {
      type: "redirect",
      url: result.initPoint,
      orderId: result.orderId,
      totals: result.totals,
      items: result.items
    };
  };

  window.PaymentProvider.register({
    id: "mercadopago",
    label: "Mercado Pago (prueba)",
    createCheckout,
    handleReturn: (params) => ({
      status: params.get("status") || params.get("collection_status") || "pending",
      orderId: params.get("order") || params.get("external_reference") || ""
    })
  });
})();
