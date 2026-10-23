/* ==========================================================================
   checkout.js — Datos, entrega y creación del pedido
   ========================================================================== */

(function () {
  "use strict";

  const form = document.querySelector("[data-checkout-form]");
  const emptyState = document.querySelector("[data-checkout-empty]");
  const formContent = document.querySelector("[data-checkout-content]");
  const shippingSelect = document.querySelector("[data-checkout-shipping]");
  const addressFields = document.querySelector("[data-checkout-address]");
  const paymentOptions = document.querySelector("[data-checkout-payments]");
  const summaryItems = document.querySelector("[data-checkout-items]");
  const subtotalElement = document.querySelector("[data-checkout-subtotal]");
  const discountRow = document.querySelector("[data-checkout-discount-row]");
  const discountElement = document.querySelector("[data-checkout-discount]");
  const shippingElement = document.querySelector("[data-checkout-shipping-cost]");
  const totalElement = document.querySelector("[data-checkout-total]");
  const freeShippingText = document.querySelector("[data-checkout-free-shipping-text]");
  const message = document.querySelector("[data-checkout-message]");
  const fallback = document.querySelector("[data-checkout-fallback]");
  const fallbackLink = document.querySelector("[data-checkout-whatsapp]");
  const fallbackReceipt = document.querySelector("[data-checkout-receipt]");
  const submitButton = form.querySelector('button[type="submit"]');
  const config = window.STORE_CONFIG || {};
  let items = window.Cart.getItems();

  const showMessage = (text, isError) => {
    message.textContent = text || "";
    message.hidden = !text;
    message.classList.toggle("is-error", Boolean(isError));
  };

  const selectedShipping = () => {
    const option = shippingSelect.selectedOptions[0];
    if (!option || !option.value) return null;
    return {
      id: option.dataset.id,
      label: option.textContent,
      cost: Number(option.dataset.cost) || 0,
      method: option.dataset.method
    };
  };

  const selectedPayment = () =>
    paymentOptions.querySelector('input[name="payment"]:checked')?.value || "whatsapp";

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const paymentMethod = selectedPayment();
    const discountPercent = Math.max(0, Math.min(100, Number(config.payments && config.payments.transferDiscountPercent) || 0));
    const discount = paymentMethod === "transfer" ? Math.round(subtotal * discountPercent / 100) : 0;
    const shipping = selectedShipping();
    const freeShippingFrom = Number(config.shipping && config.shipping.freeShippingFrom) || 0;
    const shippingCost = !shipping
      ? 0
      : shipping.method === "pickup"
        ? shipping.cost
        : freeShippingFrom > 0 && subtotal >= freeShippingFrom
          ? 0
          : shipping.cost;
    return {
      subtotal,
      discount,
      shipping: shippingCost,
      total: Math.max(0, subtotal - discount) + shippingCost,
      paymentMethod
    };
  };

  const renderSummary = () => {
    summaryItems.replaceChildren();
    items.forEach((item) => {
      const row = document.createElement("li");
      const name = document.createElement("span");
      const variantText = item.variants.map((variant) => variant.label + ": " + variant.value).join(" · ");
      name.textContent = item.name + (variantText ? " (" + variantText + ")" : "") + " × " + item.qty;
      const price = document.createElement("strong");
      price.textContent = window.Utils.formatPrice(item.unitPrice * item.qty);
      row.append(name, price);
      summaryItems.appendChild(row);
    });

    const shipping = selectedShipping();
    const totals = calculateTotals();
    subtotalElement.textContent = window.Utils.formatPrice(totals.subtotal);
    discountRow.hidden = totals.discount === 0;
    discountElement.textContent = "−" + window.Utils.formatPrice(totals.discount);
    shippingElement.textContent = shipping
      ? totals.shipping === 0
        ? window.Utils.formatPrice(0)
        : window.Utils.formatPrice(totals.shipping)
      : "A coordinar";
    totalElement.textContent = window.Utils.formatPrice(totals.total);
    const freeShippingFrom = Number(config.shipping && config.shipping.freeShippingFrom) || 0;
    freeShippingText.textContent = !shipping || shipping.method === "pickup"
      ? ""
      : totals.shipping === 0
        ? "¡Tu compra alcanza el mínimo para envío gratis!"
        : freeShippingFrom > 0
          ? "Te faltan " + window.Utils.formatPrice(freeShippingFrom - totals.subtotal) + " para el envío gratis."
          : "";
  };

  const renderShippingOptions = () => {
    const shipping = config.shipping || {};
    if (shipping.pickup && shipping.pickup.enabled) {
      const option = document.createElement("option");
      option.value = "pickup";
      option.dataset.id = "pickup";
      option.dataset.method = "pickup";
      option.dataset.cost = String(Number(shipping.pickup.cost) || 0);
      option.textContent = shipping.pickup.label;
      shippingSelect.appendChild(option);
    }
    (shipping.zones || []).forEach((zone) => {
      const option = document.createElement("option");
      option.value = zone.id;
      option.dataset.id = zone.id;
      option.dataset.method = "delivery";
      option.dataset.cost = String(Number(zone.cost) || 0);
      option.textContent = zone.label;
      shippingSelect.appendChild(option);
    });
  };

  const renderPaymentOptions = () => {
    const transferPercent = Math.max(0, Math.min(100, Number(config.payments && config.payments.transferDiscountPercent) || 0));
    paymentOptions.querySelector("[data-transfer-discount-label]").textContent =
      transferPercent ? " (−" + transferPercent + "%)" : "";
    paymentOptions.querySelector("[data-transfer-payment]").disabled = transferPercent <= 0;
    if (transferPercent <= 0) {
      paymentOptions.querySelector("[data-whatsapp-payment]").checked = true;
    }
  };

  const syncShippingFields = () => {
    const shipping = selectedShipping();
    const isDelivery = shipping && shipping.method === "delivery";
    addressFields.hidden = !isDelivery;
    addressFields.querySelectorAll("[data-required-delivery]").forEach((field) => {
      field.required = Boolean(isDelivery);
    });
  };

  const validatePersonalFields = () => {
    const name = form.elements.name;
    name.setCustomValidity(name.value.trim().length < 3
      ? "Ingresá tu nombre y apellido."
      : "");

    const phone = form.elements.phone;
    const phoneDigits = phone.value.replace(/\D/g, "");
    phone.setCustomValidity(phoneDigits.length < 10 || phoneDigits.length > 15
      ? "Ingresá un teléfono válido con característica y número."
      : "");

    const dni = form.elements.dni;
    const dniDigits = dni.value.replace(/\D/g, "");
    dni.setCustomValidity(dniDigits.length < 7 || dniDigits.length > 8
      ? "El DNI debe tener 7 u 8 números."
      : "");

    const postalCode = form.elements.postalCode;
    if (!postalCode.required || !postalCode.value) {
      postalCode.setCustomValidity("");
    } else {
      postalCode.setCustomValidity(/^(?:\d{4}|[A-Za-z]\d{4}[A-Za-z]{3})$/.test(postalCode.value.trim())
        ? ""
        : "Ingresá un código postal válido (por ejemplo, 1425 o C1425ABC).");
    }

    ["address", "city", "province"].forEach((fieldName) => {
      const field = form.elements[fieldName];
      field.setCustomValidity(!field.required || field.value.trim().length >= 2
        ? ""
        : "Completá este dato para coordinar la entrega.");
    });
  };

  const buildOrder = () => {
    const shippingChoice = selectedShipping();
    if (!shippingChoice) throw new Error("Elegí una forma de entrega.");

    const customer = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      dni: form.elements.dni.value.replace(/\D/g, "")
    };
    const shipping = {
      method: shippingChoice.method,
      zoneId: shippingChoice.id,
      label: shippingChoice.label,
      address: form.elements.address.value.trim(),
      city: form.elements.city.value.trim(),
      province: form.elements.province.value.trim(),
      postalCode: form.elements.postalCode.value.trim(),
      notes: form.elements.notes.value.trim(),
      cost: calculateTotals().shipping
    };
    const totals = calculateTotals();
    const providerId = config.payments && config.payments.provider;
    const order = {
      orderId: window.Utils.generateOrderId(),
      createdAt: new Date().toISOString(),
      status: "pending",
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variants.map((variant) => variant.id).join(","),
        variants: item.variants,
        qty: item.qty,
        unitPrice: item.unitPrice,
        name: item.name
      })),
      customer,
      shipping,
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        total: totals.total
      },
      payment: {
        provider: providerId,
        method: totals.paymentMethod,
        status: "pending"
      }
    };
    return { order, provider: window.PaymentProvider.get(providerId) };
  };

  const startCheckout = async (event) => {
    event.preventDefault();
    showMessage("");
    validatePersonalFields();
    if (!shippingSelect.value) {
      shippingSelect.setCustomValidity("Elegí una forma de entrega.");
    } else {
      shippingSelect.setCustomValidity("");
    }
    if (!form.reportValidity()) return;
    if (!items.length) {
      showMessage("Tu carrito está vacío. Volvé a la tienda para elegir productos.", true);
      return;
    }

    const submitLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Preparando pedido…";
    let blankWindow;
    try {
      blankWindow = window.open("about:blank", "_blank");
      const { order, provider } = buildOrder();
      const result = await provider.createCheckout(order);
      if (!result || !result.url || !result.orderId) {
        throw new Error("El proveedor no pudo preparar el pedido.");
      }
      window.Orders.savePending(order);
      if (blankWindow) {
        blankWindow.opener = null;
        blankWindow.location.href = result.url;
        window.location.href = "gracias.html?order=" + encodeURIComponent(result.orderId);
        return;
      }

      fallbackLink.href = result.url;
      fallbackReceipt.href = "gracias.html?order=" + encodeURIComponent(result.orderId);
      fallback.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
      showMessage("El pedido quedó preparado, pero el navegador bloqueó la nueva pestaña. Usá el botón de WhatsApp para enviarlo.", true);
      fallbackLink.focus();
    } catch (error) {
      if (blankWindow) blankWindow.close();
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
      console.error("No se pudo preparar el pedido.", error);
      showMessage(error.message || "No pudimos preparar el pedido. Revisá los datos e intentá de nuevo.", true);
    }
  };

  renderShippingOptions();
  renderPaymentOptions();
  renderSummary();
  syncShippingFields();
  const renderCartAvailability = () => {
    emptyState.hidden = items.length > 0;
    formContent.hidden = items.length === 0;
  };
  renderCartAvailability();
  window.addEventListener("cart:change", (event) => {
    items = event.detail.items;
    renderCartAvailability();
    renderSummary();
  });
  shippingSelect.addEventListener("change", () => {
    syncShippingFields();
    renderSummary();
  });
  paymentOptions.addEventListener("change", renderSummary);
  form.addEventListener("input", (event) => {
    if (["name", "phone", "dni", "postalCode", "address", "city", "province"].includes(event.target.name)) {
      event.target.setCustomValidity("");
    }
  });
  form.addEventListener("submit", startCheckout);
})();
