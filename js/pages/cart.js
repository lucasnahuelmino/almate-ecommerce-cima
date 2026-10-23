/* ==========================================================================
   cart.js — Página del carrito
   ========================================================================== */

(function () {
  "use strict";

  const container = document.querySelector("[data-cart-items]");
  const emptyState = document.querySelector("[data-cart-empty]");
  const cartContent = document.querySelector("[data-cart-content]");
  const subtotalElement = document.querySelector("[data-cart-subtotal]");
  const shippingText = document.querySelector("[data-page-shipping-text]");
  const shippingFill = document.querySelector("[data-page-shipping-fill]");
  const shippingProgress = document.querySelector("[data-page-shipping-progress]");
  const messages = document.querySelector("[data-page-cart-messages]");
  const feedback = document.querySelector("[data-page-cart-feedback]");
  const whatsappLink = document.querySelector("[data-cart-whatsapp]");
  const config = window.STORE_CONFIG || {};

  const renderMessages = () => {
    const notices = window.Cart.getNotices();
    const storageError = window.Cart.getStorageError();
    const allMessages = notices.concat(storageError ? [storageError] : []);
    messages.textContent = allMessages.join(" ");
    messages.hidden = allMessages.length === 0;
  };

  const updateWhatsAppLink = (items, subtotal) => {
    const phone = config.contact && config.contact.whatsapp;
    if (!phone || !items.length) {
      whatsappLink.hidden = true;
      whatsappLink.removeAttribute("href");
      return;
    }

    const lines = items.map((item) => {
      const variants = item.variants.map((variant) => variant.label + ": " + variant.value).join(", ");
      return "- " + item.name + (variants ? " (" + variants + ")" : "") +
        " — " + item.qty + " x " + window.Utils.formatPrice(item.unitPrice);
    });
    const message = [
      "Hola, quiero consultar para coordinar esta compra:",
      "",
      ...lines,
      "",
      "Subtotal de productos: " + window.Utils.formatPrice(subtotal),
      "¿Me indican opciones de envío y medios de pago?"
    ].join("\n");
    whatsappLink.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
    whatsappLink.hidden = false;
  };

  const render = () => {
    const items = window.Cart.getItems();
    const subtotal = window.Cart.getSubtotal();
    const freeShippingFrom = Number(config.shipping && config.shipping.freeShippingFrom) || 0;
    container.replaceChildren();
    renderMessages();
    emptyState.hidden = items.length > 0;
    cartContent.hidden = items.length === 0;
    updateWhatsAppLink(items, subtotal);

    if (!items.length) return;
    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "cart-line";
      const media = document.createElement("a");
      media.className = "cart-line__media";
      media.href = "producto.html?slug=" + encodeURIComponent(item.slug);
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = "";
      image.loading = "lazy";
      media.appendChild(image);

      const info = document.createElement("div");
      info.className = "cart-line__info";
      const name = document.createElement("a");
      name.className = "cart-line__name";
      name.href = media.href;
      name.textContent = item.name;
      const variants = document.createElement("p");
      variants.className = "cart-line__variants";
      variants.textContent = item.variants.map((variant) => variant.label + ": " + variant.value).join(" · ");
      variants.hidden = !variants.textContent;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mini-cart-item__remove";
      remove.dataset.cartRemove = item.id;
      remove.textContent = "Quitar";
      info.append(name, variants, remove);

      const quantityLabel = document.createElement("label");
      quantityLabel.className = "field cart-line__quantity";
      const label = document.createElement("span");
      label.className = "field__label";
      label.textContent = "Cantidad";
      const quantity = document.createElement("input");
      quantity.className = "field__input";
      quantity.type = "number";
      quantity.min = "1";
      quantity.max = String(item.stock);
      quantity.value = String(item.qty);
      quantity.inputMode = "numeric";
      quantity.dataset.cartQuantity = item.id;
      quantity.setAttribute("aria-label", "Cantidad de " + item.name);
      quantityLabel.append(label, quantity);

      const price = document.createElement("p");
      price.className = "cart-line__price";
      price.textContent = window.Utils.formatPrice(item.unitPrice * item.qty);
      row.append(media, info, quantityLabel, price);
      container.appendChild(row);
    });

    subtotalElement.textContent = window.Utils.formatPrice(subtotal);
    if (freeShippingFrom > 0) {
      const remaining = Math.max(0, freeShippingFrom - subtotal);
      shippingProgress.hidden = false;
      shippingText.textContent = remaining
        ? "Te faltan " + window.Utils.formatPrice(remaining) + " para acceder al envío gratis."
        : "¡Alcanzaste el mínimo para el envío gratis!";
      const percentage = Math.min(100, Math.round(subtotal / freeShippingFrom * 100));
      shippingFill.style.width = percentage + "%";
      shippingFill.setAttribute("aria-valuenow", String(percentage));
    } else {
      shippingProgress.hidden = true;
    }
  };

  document.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-cart-remove]");
    if (removeButton) window.Cart.remove(removeButton.dataset.cartRemove);
    if (event.target.closest("[data-cart-clear]")) window.Cart.clear();
  });

  container.addEventListener("change", (event) => {
    const input = event.target.closest("[data-cart-quantity]");
    if (!input) return;
    const result = window.Cart.update(input.dataset.cartQuantity, Number(input.value));
    if (!result.ok) {
      feedback.textContent = result.message;
      feedback.hidden = false;
      render();
    } else {
      feedback.textContent = "";
      feedback.hidden = true;
    }
  });

  window.addEventListener("cart:change", render);
  render();
})();
