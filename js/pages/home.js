/* ==========================================================================
   home.js — Contenido dinámico de la página de inicio
   ========================================================================== */

(function () {
  "use strict";

  const categories = (window.CATEGORIES || [])
    .filter((category) => !category.isVirtual && category.image)
    .slice(0, 4);
  const products = (window.PRODUCTS || []).filter((product) => product.active && product.stock > 0);
  const featuredProducts = products.filter((product) => product.featured).slice(0, 4);
  const offerProducts = products
    .filter((product) => product.comparePrice > product.price)
    .slice(0, 2);
  const config = window.STORE_CONFIG || {};

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };

  const getWhatsAppUrl = (message) => {
    const phone = config.contact && config.contact.whatsapp;
    if (!phone) return "";
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
  };

  const renderCategories = () => {
    const container = document.querySelector("[data-home-categories]");
    if (!container) return;

    categories.forEach((category, index) => {
      const card = createElement("a", "category-card category-card--" + (index + 1));
      card.href = "tienda.html?category=" + encodeURIComponent(category.slug);
      card.setAttribute("aria-label", "Ver productos de " + category.name);
      const image = createElement("img", "category-card__image");
      image.src = category.image;
      image.alt = "";
      image.loading = "lazy";

      const content = createElement("div", "category-card__content");
      content.setAttribute("aria-hidden", "true");
      content.append(
        createElement("span", "category-card__number", "0" + (index + 1)),
        createElement("h3", "", category.name),
        createElement("p", "", category.description)
      );

      card.append(image, content);
      container.appendChild(card);
    });
  };

  const createProductCard = (product) => {
    const category = (window.CATEGORIES || []).find((item) => item.id === product.category);
    const card = createElement("article", "card home-product-card");
    const media = createElement("div", "card__media");
    const mediaLink = createElement("a");
    mediaLink.href = "producto.html?slug=" + encodeURIComponent(product.slug);
    mediaLink.setAttribute("aria-label", "Ver " + product.name);
    const image = createElement("img");
    image.src = product.images && product.images[0] ? product.images[0] : "";
    image.alt = product.name;
    image.loading = "lazy";
    mediaLink.appendChild(image);
    media.appendChild(mediaLink);

    const badges = createElement("div", "card__badges");
    const discount = product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;

    if (discount) badges.appendChild(createElement("span", "badge badge--offer", "-" + discount + "%"));
    if (product.tags && product.tags.includes("nuevo")) {
      badges.appendChild(createElement("span", "badge badge--new", "Nuevo"));
    }
    if (badges.childElementCount) media.appendChild(badges);

    const body = createElement("div", "card__body");
    body.appendChild(createElement("p", "card__category", category ? category.name : "Bazar"));
    const title = createElement("h3", "card__title");
    const titleLink = createElement("a", "", product.name);
    titleLink.href = "producto.html?slug=" + encodeURIComponent(product.slug);
    title.appendChild(titleLink);
    body.appendChild(title);

    const price = createElement("p", "price");
    price.appendChild(createElement("span", "", window.Utils.formatPrice(product.price)));
    if (discount) {
      price.appendChild(createElement("span", "price__compare", window.Utils.formatPrice(product.comparePrice)));
    }
    body.appendChild(price);

    const installmentText = config.payments && config.payments.installments &&
      config.payments.installments.enabled && config.payments.installments.text;
    if (installmentText) {
      body.appendChild(createElement("p", "home-product-card__installments", installmentText));
    }

    const link = createElement("a", "btn btn--outline btn--block home-product-card__action", "Ver producto");
    link.href = "producto.html?slug=" + encodeURIComponent(product.slug);
    body.appendChild(link);

    card.append(media, body);
    return card;
  };

  const renderProducts = (selector, list) => {
    const container = document.querySelector(selector);
    if (!container) return;
    list.forEach((product) => container.appendChild(createProductCard(product)));
  };

  const fillConfiguredText = () => {
    const freeShippingFrom = config.shipping && config.shipping.freeShippingFrom;
    const freeShippingText = freeShippingFrom
      ? window.Utils.formatPrice(freeShippingFrom)
      : "el monto indicado en la tienda";

    document.querySelectorAll("[data-free-shipping]").forEach((element) => {
      element.textContent = freeShippingText;
    });

    const installments = config.payments && config.payments.installments;
    const installmentText = installments && installments.enabled
      ? installments.text
      : "Consultá las opciones de pago disponibles";
    document.querySelectorAll("[data-installments]").forEach((element) => {
      element.textContent = installmentText;
    });
  };

  renderCategories();
  renderProducts("[data-home-featured]", featuredProducts);
  renderProducts("[data-home-offers]", offerProducts);
  fillConfiguredText();

  document.querySelectorAll("[data-wa]").forEach((element) => {
    const url = getWhatsAppUrl(element.getAttribute("data-wa"));
    if (!url) {
      element.hidden = true;
      return;
    }
    element.href = url;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
  });
})();
