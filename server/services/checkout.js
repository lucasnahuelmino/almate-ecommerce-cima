const { randomUUID } = require("node:crypto");
const {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator
} = require("mercadopago");
const {
  applyPayment,
  createPendingOrder,
  failPendingOrder,
  getPublicOrder,
  setPreferenceId
} = require("../db");
const { CheckoutError, validateOrderRequest } = require("./catalog");

const asHttpUrl = (value, label, allowLocalHttp = true) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new CheckoutError(`${label} debe ser una URL HTTPS válida.`, 503);
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!["https:", ...(allowLocalHttp && local ? ["http:"] : [])].includes(url.protocol) ||
      url.username || url.password) {
    throw new CheckoutError(`${label} debe usar HTTPS; HTTP solo está permitido en localhost.`, 503);
  }
  return url;
};

const createCheckoutService = ({
  database,
  config,
  mercadoPago,
  frontendUrl,
  publicApiUrl,
  webhookSecret,
  now = () => new Date()
}) => {
  if (!database || !config || !mercadoPago) {
    throw new Error("La base, la configuración y el gateway de pago son obligatorios.");
  }

  const createCheckout = async (input) => {
    if (!webhookSecret) {
      throw new CheckoutError("El webhook de Mercado Pago no está configurado.", 503);
    }
    if (input && input.payment && input.payment.method !== "mercadopago") {
      throw new CheckoutError("Este endpoint solo admite pagos de prueba de Mercado Pago.");
    }
    const frontend = asHttpUrl(frontendUrl, "FRONTEND_URL");
    const publicApi = asHttpUrl(publicApiUrl, "PUBLIC_API_URL");
    const validated = validateOrderRequest(database, config, input);
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    const order = {
      orderId: randomUUID(),
      createdAt: createdAt.toISOString(),
      status: "pending",
      items: validated.items,
      customer: validated.customer,
      shipping: validated.shipping,
      totals: validated.totals,
      payment: { provider: "mercadopago", method: "mercadopago", status: "pending" }
    };

    createPendingOrder(database, order, expiresAt.toISOString());
    const successUrl = new URL("gracias.html", frontend);
    successUrl.searchParams.set("order", order.orderId);
    const notificationUrl = new URL("api/webhooks/mercadopago", publicApi);
    const preferenceItems = order.items.map((item) => ({
      id: item.sku,
      title: item.name + (item.variants.length
        ? " (" + item.variants.map((variant) => variant.label + ": " + variant.value).join(", ") + ")"
        : ""),
      quantity: item.qty,
      unit_price: item.unitPrice,
      currency_id: "ARS"
    }));
    if (order.shipping.cost > 0) {
      preferenceItems.push({
        id: "shipping",
        title: "Envío — " + order.shipping.label,
        quantity: 1,
        unit_price: order.shipping.cost,
        currency_id: "ARS"
      });
    }
    const payerName = order.customer.name.split(/\s+/);
    const preference = {
      items: preferenceItems,
      payer: {
        name: payerName.shift(),
        surname: payerName.join(" ") || undefined,
        email: order.customer.email
      },
      external_reference: order.orderId,
      back_urls: {
        success: successUrl.toString(),
        pending: successUrl.toString(),
        failure: successUrl.toString()
      },
      auto_return: "approved",
      notification_url: notificationUrl.toString(),
      statement_descriptor: "CIMA",
      metadata: { order_id: order.orderId },
      expires: true,
      expiration_date_from: createdAt.toISOString(),
      expiration_date_to: expiresAt.toISOString()
    };

    try {
      const result = await mercadoPago.createPreference(preference);
      const initPoint = result && result.sandbox_init_point;
      let checkoutUrl;
      try {
        checkoutUrl = new URL(initPoint);
      } catch {
        throw new Error("Mercado Pago no devolvió un enlace de pago de prueba válido.");
      }
      if (checkoutUrl.protocol !== "https:" ||
          !["sandbox.mercadopago.com", "sandbox.mercadopago.com.ar"].includes(checkoutUrl.hostname)) {
        throw new Error("Mercado Pago no devolvió un enlace de pago sandbox.");
      }
      if (!result.id || !setPreferenceId(database, order.orderId, String(result.id))) {
        throw new Error("No se pudo asociar la preferencia con el pedido.");
      }
      return {
        orderId: order.orderId,
        initPoint: checkoutUrl.toString(),
        totals: order.totals,
        items: order.items
      };
    } catch (error) {
      failPendingOrder(database, order.orderId);
      if (error.status) throw error;
      console.error("No se pudo crear la preferencia de Mercado Pago.", error);
      throw new CheckoutError("No pudimos iniciar el pago de prueba. Revisá la configuración de Mercado Pago e intentá nuevamente.", 502);
    }
  };

  const handleWebhook = async (notification) => {
    if (!webhookSecret) {
      throw new CheckoutError("El webhook de Mercado Pago no está configurado.", 503);
    }
    const signature = notification && notification.signature || {};
    try {
      WebhookSignatureValidator.validate({
        xSignature: signature.xSignature,
        xRequestId: signature.xRequestId,
        dataId: signature.dataId,
        secret: webhookSecret
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new CheckoutError("La firma de la notificación de Mercado Pago no es válida.", 401);
      }
      throw error;
    }
    if (notification.type && notification.type !== "payment") {
      return { ignored: true };
    }

    const paymentId = notification && notification.id;
    if (!paymentId || !/^\d{1,30}$/.test(String(paymentId))) {
      throw new CheckoutError("La notificación no incluye un ID de pago válido.");
    }
    let payment;
    try {
      payment = await mercadoPago.getPayment(String(paymentId));
    } catch (error) {
      console.error("No se pudo verificar el pago con Mercado Pago.", error);
      throw new CheckoutError("No se pudo verificar el pago; Mercado Pago puede volver a notificarlo.", 502);
    }
    if (!payment || String(payment.id) !== String(paymentId) ||
        typeof payment.external_reference !== "string" ||
        !["approved", "pending", "in_process", "authorized", "rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
      throw new CheckoutError("La respuesta de Mercado Pago no identifica un pago válido.");
    }
    return applyPayment(database, payment);
  };

  return {
    createCheckout,
    handleWebhook,
    getOrder: (orderId) => getPublicOrder(database, orderId)
  };
};

module.exports = { createCheckoutService };
