/* ==========================================================================
   mini-cart.js — Drawer lateral del carrito
   --------------------------------------------------------------------------
   Abre/cierra el panel, maneja foco (accesibilidad) y renderiza los ítems.

   La LÓGICA del carrito (agregar, quitar, persistir) vive en js/core/cart.js
   (Etapa 7). Este archivo solo dibuja lo que cart.js le indique, por eso
   funciona aunque el carrito todavía no exista: si no hay window.Cart,
   muestra el estado vacío.
   ========================================================================== */

(function () {
  "use strict";

  const $ = window.Utils.$;
  const $$ = window.Utils.$$;
  const formatPrice = window.Utils.formatPrice;

  const drawer = $("#mini-cart");
  const backdrop = $("#cart-backdrop");
  if (!drawer || !backdrop) return;

  let lastFocused = null;

  /* ---------- Abrir / cerrar ---------- */
  const isOpen = () => drawer.classList.contains("is-open");

  const open = () => {
    lastFocused = document.activeElement;
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    // El foco pasa al botón de cerrar del panel
    window.requestAnimationFrame(() => {
      if (isOpen()) drawer.querySelector("[data-cart-close]")?.focus();
    });
    document.addEventListener("keydown", onKeydown);
  };

  const close = () => {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    // Devuelve el foco a quien abrió el drawer
    lastFocused?.focus?.();
  };

  // Escape cierra; Tab queda atrapado dentro del drawer (ciclo de foco)
  const onKeydown = (e) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    const items = $$(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      drawer
    ).filter((el) => el.getClientRects().length > 0); // solo visibles
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  // Todo lo que diga data-cart-open / data-cart-close controla el drawer
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cart-open]")) { e.preventDefault(); open(); }
    if (e.target.closest("[data-cart-close]")) { e.preventDefault(); close(); }
  });
  backdrop.addEventListener("click", close);

  /* ---------- Render ---------- */
  const body = drawer.querySelector(".mini-cart__body");
  const emptyState = drawer.querySelector(".mini-cart__empty");
  const summary = drawer.querySelector(".mini-cart__summary");
  const message = drawer.querySelector("[data-cart-message]");
  const noticesElement = drawer.querySelector("[data-cart-notices]");
  const shippingProgress = drawer.querySelector("[data-cart-shipping-progress]");
  const shippingText = drawer.querySelector("[data-cart-shipping-text]");
  const shippingFill = drawer.querySelector("[data-cart-shipping-fill]");

  const showMessage = (text) => {
    if (!message) return;
    message.textContent = text || "";
    message.hidden = !text;
  };

  const renderNotices = (notices, storageError) => {
    const messages = (notices || []).concat(storageError ? [storageError] : []);
    if (!noticesElement) return;
    noticesElement.textContent = messages.join(" ");
    noticesElement.hidden = messages.length === 0;
  };

  /** Pinta el drawer con los ítems que recibe (o estado vacío). */
  const render = (items, totals, state) => {
    const list = items || [];
    const subtotal = totals && totals.subtotal != null
      ? totals.subtotal
      : list.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

    $$(".mini-cart-item", body).forEach((el) => el.remove());
    showMessage("");
    renderNotices(state && state.notices, state && state.storageError);

    if (!list.length) {
      emptyState.hidden = false;
      summary.hidden = true;
      if (shippingProgress) shippingProgress.hidden = true;
      return;
    }

    emptyState.hidden = true;
    summary.hidden = false;

    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "mini-cart-item";
      const image = document.createElement("img");
      image.className = "mini-cart-item__img";
      image.src = item.image;
      image.alt = "";
      image.loading = "lazy";
      const details = document.createElement("div");
      const name = document.createElement("p");
      name.className = "mini-cart-item__name";
      name.textContent = item.name;
      const variantText = item.variants.map((variant) => variant.label + ": " + variant.value).join(" · ");
      const meta = document.createElement("p");
      meta.className = "mini-cart-item__meta";
      meta.textContent = (variantText ? variantText + " · " : "") + "Cantidad: " + item.qty;
      const controls = document.createElement("div");
      controls.className = "mini-cart-item__controls";
      const quantity = document.createElement("input");
      quantity.className = "field__input mini-cart-item__quantity";
      quantity.type = "number";
      quantity.min = "1";
      quantity.max = String(item.stock);
      quantity.value = String(item.qty);
      quantity.inputMode = "numeric";
      quantity.setAttribute("aria-label", "Cantidad de " + item.name);
      quantity.dataset.cartQuantity = item.id;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mini-cart-item__remove";
      remove.dataset.cartRemove = item.id;
      remove.textContent = "Quitar";
      const price = document.createElement("p");
      price.className = "mini-cart-item__price";
      price.textContent = formatPrice(item.unitPrice * item.qty);
      details.append(name, meta, controls);
      controls.append(quantity, remove);
      row.append(image, details, price);
      body.appendChild(row);
    });

    const subtotalEl = drawer.querySelector("[data-subtotal]");
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    const shippingConfig = window.STORE_CONFIG && window.STORE_CONFIG.shipping;
    const freeShippingFrom = Number(shippingConfig && shippingConfig.freeShippingFrom) || 0;
    if (shippingProgress && freeShippingFrom > 0) {
      const remaining = Math.max(0, freeShippingFrom - subtotal);
      shippingProgress.hidden = false;
      shippingText.textContent = remaining
        ? "Te faltan " + formatPrice(remaining) + " para el envío gratis."
        : "¡Tu compra alcanza el mínimo para envío gratis!";
      shippingFill.style.width = Math.min(100, subtotal / freeShippingFrom * 100) + "%";
      shippingFill.setAttribute("aria-valuenow", String(Math.min(100, Math.round(subtotal / freeShippingFrom * 100))));
    } else if (shippingProgress) {
      shippingProgress.hidden = true;
    }
  };

  document.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-cart-remove]");
    if (removeButton && window.Cart) window.Cart.remove(removeButton.dataset.cartRemove);
  });

  body.addEventListener("change", (event) => {
    const input = event.target.closest("[data-cart-quantity]");
    if (!input || !window.Cart) return;
    const result = window.Cart.update(input.dataset.cartQuantity, Number(input.value));
    if (!result.ok) {
      showMessage(result.message);
      const item = window.Cart.getItems().find((entry) => entry.id === input.dataset.cartQuantity);
      if (item) input.value = String(item.qty);
    }
  });

  window.addEventListener("cart:change", (event) => {
    render(event.detail.items, event.detail.totals, event.detail);
    if (typeof window.refreshCartCount === "function") {
      window.refreshCartCount(event.detail.totals.count > 0);
    }
  });

  window.MiniCart = { open, close, render, isOpen, announce: showMessage };

  render(
    window.Cart ? window.Cart.getItems() : [],
    window.Cart ? { subtotal: window.Cart.getSubtotal() } : null,
    window.Cart ? {
      notices: window.Cart.getNotices(),
      storageError: window.Cart.getStorageError()
    } : null
  );
})();
