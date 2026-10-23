const { availableStock } = require("../db");

class CheckoutError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, maxLength) =>
  typeof value === "string" && value.trim().length <= maxLength ? value.trim() : "";

const validateOrderRequest = (database, config, input) => {
  if (!isRecord(input) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
    throw new CheckoutError("El pedido debe incluir entre 1 y 20 productos.");
  }
  if (!isRecord(input.customer) || !isRecord(input.shipping)) {
    throw new CheckoutError("Faltan los datos de contacto o entrega.");
  }
  const paymentMethod = isRecord(input.payment) && typeof input.payment.method === "string"
    ? input.payment.method
    : "mercadopago";
  if (!["mercadopago", "whatsapp", "transfer"].includes(paymentMethod)) {
    throw new CheckoutError("Elegí una forma de pago válida.");
  }

  const customer = {
    name: text(input.customer.name, 100),
    email: text(input.customer.email, 150).toLowerCase(),
    phone: text(input.customer.phone, 32).replace(/\D/g, ""),
    dni: text(input.customer.dni, 16).replace(/\D/g, "")
  };
  if (customer.name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
      customer.phone.length < 10 || customer.phone.length > 15 ||
      customer.dni.length < 7 || customer.dni.length > 8) {
    throw new CheckoutError("Revisá el nombre, email, teléfono y DNI.");
  }

  const method = input.shipping.method;
  let zoneId;
  let shippingLabel;
  let baseShippingCost;
  if (method === "pickup") {
    const pickup = config.shipping && config.shipping.pickup;
    if (!pickup || !pickup.enabled) throw new CheckoutError("El retiro coordinado no está disponible.");
    zoneId = "pickup";
    shippingLabel = pickup.label;
    baseShippingCost = Number(pickup.cost) || 0;
  } else if (method === "delivery") {
    zoneId = text(input.shipping.zoneId, 50);
    const zone = (config.shipping && config.shipping.zones || []).find((item) => item.id === zoneId);
    if (!zone) throw new CheckoutError("Elegí una zona de entrega válida.");
    shippingLabel = zone.label;
    baseShippingCost = Number(zone.cost) || 0;
  } else {
    throw new CheckoutError("Elegí una forma de entrega válida.");
  }

  const shipping = {
    method,
    zoneId,
    label: shippingLabel,
    address: text(input.shipping.address, 150),
    city: text(input.shipping.city, 100),
    province: text(input.shipping.province, 100),
    postalCode: text(input.shipping.postalCode, 16).toUpperCase(),
    notes: text(input.shipping.notes, 300)
  };
  if (method === "delivery" &&
      (shipping.address.length < 3 || shipping.city.length < 2 || shipping.province.length < 2 ||
        !/^(?:\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(shipping.postalCode))) {
    throw new CheckoutError("Completá una dirección y un código postal válidos para el envío.");
  }

  const items = input.items.map((requested) => {
    if (!isRecord(requested) || typeof requested.productId !== "string" ||
        !Number.isSafeInteger(requested.qty) || requested.qty < 1 || requested.qty > 50) {
      throw new CheckoutError("Uno de los productos tiene una cantidad inválida.");
    }
    const productRow = database.prepare(
      "SELECT data FROM products WHERE id = ? AND active = 1"
    ).get(requested.productId);
    if (!productRow) throw new CheckoutError("Uno de los productos ya no está disponible.", 409);
    const product = JSON.parse(productRow.data);
    const stock = availableStock(database, product.id);
    if (stock < requested.qty) {
      throw new CheckoutError(`No hay stock suficiente de "${product.name}".`, 409);
    }

    const definitions = Array.isArray(product.variants) ? product.variants : [];
    const selections = requested.variants === undefined ? [] : requested.variants;
    if (!Array.isArray(selections) || selections.length !== definitions.length) {
      throw new CheckoutError(`Revisá las opciones de "${product.name}".`);
    }
    const variants = definitions.map((definition) => {
      const selection = selections.find((item) => isRecord(item) && item.id === definition.id);
      if (!selection || !definition.options.includes(selection.value)) {
        throw new CheckoutError(`Elegí una opción válida para "${product.name}".`);
      }
      return { id: definition.id, label: definition.label, value: selection.value };
    });

    return {
      productId: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      qty: requested.qty,
      unitPrice: product.price,
      variants
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal <= 0) {
    throw new CheckoutError("El total del pedido no es válido.");
  }
  const freeShippingFrom = Number(config.shipping && config.shipping.freeShippingFrom) || 0;
  const shippingCost = method === "pickup"
    ? baseShippingCost
    : freeShippingFrom > 0 && subtotal >= freeShippingFrom
      ? 0
      : baseShippingCost;
  const transferDiscountPercent = Math.max(
    0,
    Math.min(100, Number(config.payments && config.payments.transferDiscountPercent) || 0)
  );
  const discount = paymentMethod === "transfer"
    ? Math.round(subtotal * transferDiscountPercent / 100)
    : 0;
  const total = subtotal - discount + shippingCost;
  if (!Number.isSafeInteger(total) || total > 1000000000) {
    throw new CheckoutError("El total del pedido excede el límite permitido.");
  }

  shipping.cost = shippingCost;
  return {
    customer,
    items,
    shipping,
    totals: { subtotal, discount, shipping: shippingCost, total }
  };
};

module.exports = { CheckoutError, validateOrderRequest };
