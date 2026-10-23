/* ==========================================================================
   product.js — Ficha, galería, variantes y estimación de envío
   ========================================================================== */

(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const products = window.PRODUCTS || [];
  const product = products.find((item) => item.slug === slug && item.active);
  const config = window.STORE_CONFIG || {};
  const content = document.querySelector("[data-product-content]");
  const notFound = document.querySelector("[data-product-not-found]");
  const relatedSection = document.querySelector("[data-related-section]");
  const imageElement = document.querySelector("[data-gallery-main]");
  const thumbnails = document.querySelector("[data-gallery-thumbnails]");
  const quantityInput = document.querySelector("[data-product-quantity]");
  const whatsappButton = document.querySelector("[data-product-whatsapp]");
  const addButton = document.querySelector("[data-add-to-cart]");
  const mobileAddButton = document.querySelector("[data-mobile-add-to-cart]");
  const mobilePrice = document.querySelector("[data-mobile-price]");
  const bottomBar = document.querySelector("[data-product-bottom-bar]");
  const shippingSelect = document.querySelector("[data-shipping-zone]");
  const shippingResult = document.querySelector("[data-shipping-result]");
  const cartMessage = document.querySelector("[data-product-cart-message]");
  const safeTags = new Set(["P", "BR", "STRONG", "EM", "UL", "OL", "LI"]);
  let selectedImage = 0;

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };

  const makeWhatsAppUrl = () => {
    const phone = config.contact && config.contact.whatsapp;
    if (!phone || !product) return "";
    const quantity = Math.max(1, Number(quantityInput.value) || 1);
    const variantText = Array.from(document.querySelectorAll("[data-variant-select]"))
      .map((select) => select.dataset.variantLabel + ": " + select.value)
      .join(", ");
    const message = [
      "Hola, quiero consultar por este producto:",
      product.name,
      "SKU: " + product.sku,
      "Cantidad: " + quantity,
      variantText ? "Opción: " + variantText : ""
    ].filter(Boolean).join("\n");
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
  };

  const refreshWhatsAppLinks = () => {
    const available = product && product.stock > 0;
    if (!whatsappButton) return;
    const url = makeWhatsAppUrl();
    whatsappButton.href = url || "#";
    whatsappButton.hidden = !url;
    whatsappButton.setAttribute("aria-disabled", String(!available || !url));
    if (!available || !url) whatsappButton.removeAttribute("href");
  };

  const appendSanitizedNodes = (source, target) => {
    Array.from(source.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.textContent));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (!safeTags.has(node.tagName)) {
        appendSanitizedNodes(node, target);
        return;
      }

      const safeNode = document.createElement(node.tagName.toLowerCase());
      appendSanitizedNodes(node, safeNode);
      target.appendChild(safeNode);
    });
  };

  const renderDescription = (html, target) => {
    const parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    appendSanitizedNodes(parsed.body, target);
  };

  const renderGallery = () => {
    const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    if (!images.length) return;
    imageElement.src = images[0];
    imageElement.alt = product.name;
    imageElement.loading = "eager";
    imageElement.decoding = "async";
    imageElement.fetchPriority = "high";
    thumbnails.replaceChildren();

    images.forEach((src, index) => {
      const button = makeElement("button", "product-gallery__thumb");
      button.type = "button";
      button.setAttribute("aria-label", "Ver imagen " + (index + 1) + " de " + product.name);
      button.setAttribute("aria-pressed", String(index === 0));
      const image = makeElement("img");
      image.src = src;
      image.alt = "";
      image.loading = index === 0 ? "eager" : "lazy";
      button.appendChild(image);
      button.addEventListener("click", () => showImage(index));
      thumbnails.appendChild(button);
    });

    document.querySelector("[data-gallery-previous]").hidden = images.length < 2;
    document.querySelector("[data-gallery-next]").hidden = images.length < 2;
  };

  const showImage = (index) => {
    const images = product.images.filter(Boolean);
    if (!images.length) return;
    selectedImage = (index + images.length) % images.length;
    imageElement.src = images[selectedImage];
    imageElement.alt = product.name + " — imagen " + (selectedImage + 1);
    Array.from(thumbnails.children).forEach((button, buttonIndex) => {
      button.setAttribute("aria-pressed", String(buttonIndex === selectedImage));
    });
  };

  const renderBadges = () => {
    const badges = document.querySelector("[data-product-badges]");
    const discount = product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;
    if (discount) badges.appendChild(makeElement("span", "badge badge--offer", "-" + discount + "%"));
    if ((product.tags || []).includes("nuevo")) badges.appendChild(makeElement("span", "badge badge--new", "Nuevo"));
    if (product.stock === 0) badges.appendChild(makeElement("span", "badge badge--sold-out", "Agotado"));
  };

  const renderPrice = () => {
    const container = document.querySelector("[data-product-price]");
    container.replaceChildren();
    container.appendChild(makeElement("span", "product-price__current", window.Utils.formatPrice(product.price)));
    if (product.comparePrice > product.price) {
      container.appendChild(makeElement("span", "price__compare", window.Utils.formatPrice(product.comparePrice)));
    }
    const installments = config.payments && config.payments.installments;
    const installmentElement = document.querySelector("[data-product-installments]");
    if (installments && installments.enabled && installments.text) {
      installmentElement.textContent = installments.text;
    } else {
      installmentElement.hidden = true;
    }
    mobilePrice.textContent = window.Utils.formatPrice(product.price);
  };

  const renderStock = () => {
    const stock = document.querySelector("[data-product-stock]");
    if (product.stock <= 0) {
      stock.textContent = "Producto agotado";
      stock.className = "product-stock product-stock--sold-out";
      quantityInput.max = "1";
      quantityInput.disabled = true;
    } else if (product.stock <= 3) {
      stock.textContent = "¡Últimas " + product.stock + " unidades!";
      stock.className = "product-stock product-stock--low";
      quantityInput.max = String(product.stock);
    } else {
      stock.textContent = product.stock + " unidades disponibles";
      stock.className = "product-stock";
      quantityInput.max = String(product.stock);
    }
  };

  const renderVariants = () => {
    const container = document.querySelector("[data-product-variants]");
    container.replaceChildren();
    (product.variants || []).forEach((variant) => {
      if (!variant.options || !variant.options.length) return;
      const label = makeElement("label", "field product-variant");
      const labelText = makeElement("span", "field__label", variant.label);
      const select = makeElement("select", "field__input");
      select.dataset.variantSelect = "";
      select.dataset.variantId = variant.id;
      select.dataset.variantLabel = variant.label;
      select.setAttribute("aria-label", variant.label);
      variant.options.forEach((optionText) => {
        const option = makeElement("option", "", optionText);
        option.value = optionText;
        select.appendChild(option);
      });
      select.addEventListener("change", refreshWhatsAppLinks);
      label.append(labelText, select);
      container.appendChild(label);
    });
  };

  const renderSpecifications = () => {
    const container = document.querySelector("[data-product-specs]");
    container.replaceChildren();
    (product.specs || []).forEach((spec) => {
      container.append(
        makeElement("dt", "", spec.label),
        makeElement("dd", "", spec.value)
      );
    });
    if (!container.childElementCount) {
      container.textContent = "Consultanos por más información.";
    }
  };

  const renderShippingOptions = () => {
    const shipping = config.shipping || {};
    const options = [];
    if (shipping.pickup && shipping.pickup.enabled) {
      options.push({ id: "pickup", label: shipping.pickup.label, cost: shipping.pickup.cost });
    }
    (shipping.zones || []).forEach((zone) => options.push(zone));

    options.forEach((option) => {
      const element = makeElement("option", "", option.label);
      element.value = String(option.cost);
      element.dataset.id = option.id;
      shippingSelect.appendChild(element);
    });
  };

  const updateShipping = () => {
    const selected = shippingSelect.selectedOptions[0];
    if (!selected || !selected.value) {
      shippingResult.textContent = "Elegí una zona para ver el costo estimado.";
      return;
    }
    if (selected.dataset.id === "pickup") {
      shippingResult.textContent = "Retiro coordinado sin costo. Escribinos para acordar los detalles.";
      return;
    }

    const subtotal = product.price * Math.max(1, Number(quantityInput.value) || 1);
    const freeShippingFrom = Number(config.shipping && config.shipping.freeShippingFrom) || 0;
    const cost = freeShippingFrom > 0 && subtotal >= freeShippingFrom
      ? 0
      : Number(selected.value);
    shippingResult.textContent = cost === 0
      ? "¡Tenés envío gratis! El total de esta compra alcanza el mínimo de envío sin cargo."
      : "Costo estimado: " + window.Utils.formatPrice(cost) + ". Se confirma al coordinar la compra.";
  };

  const addToCart = () => {
    const variants = Array.from(document.querySelectorAll("[data-variant-select]")).map((select) => ({
      id: select.dataset.variantId,
      label: select.dataset.variantLabel,
      value: select.value
    }));
    const result = window.Cart.add(product.id, Number(quantityInput.value), variants);
    cartMessage.textContent = result.message;
    cartMessage.hidden = false;
    if (result.ok && window.MiniCart) {
      window.MiniCart.open();
      window.MiniCart.announce(result.message);
    }
  };

  const renderRelated = () => {
    const related = products
      .filter((item) => item.active && item.stock > 0 && item.id !== product.id && item.category === product.category)
      .slice(0, 4);
    if (!related.length) return;

    const container = document.querySelector("[data-related-products]");
    related.forEach((item) => {
      const card = makeElement("article", "card home-product-card");
      const media = makeElement("a", "card__media");
      media.href = "producto.html?slug=" + encodeURIComponent(item.slug);
      media.setAttribute("aria-label", "Ver " + item.name);
      const image = makeElement("img");
      image.src = item.images && item.images[0] ? item.images[0] : "";
      image.alt = item.name;
      image.loading = "lazy";
      media.appendChild(image);
      const body = makeElement("div", "card__body");
      body.appendChild(makeElement("h3", "card__title", item.name));
      body.appendChild(makeElement("p", "price", window.Utils.formatPrice(item.price)));
      const link = makeElement("a", "btn btn--outline btn--block home-product-card__action", "Ver producto");
      link.href = "producto.html?slug=" + encodeURIComponent(item.slug);
      body.appendChild(link);
      card.append(media, body);
      container.appendChild(card);
    });
    relatedSection.hidden = false;
  };

  const renderStructuredData = (category) => {
    const baseUrl = window.location.href.split("?")[0];
    const productUrl = baseUrl + "?slug=" + encodeURIComponent(product.slug);
    const structuredProduct = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.shortDescription || product.name,
      sku: product.sku,
      category: category ? category.name : product.category,
      image: (product.images || []).map((image) => new URL(image, window.location.href).href),
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: (config.currency && config.currency.code) || "ARS",
        price: String(product.price),
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition"
      }
    };
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: new URL("index.html", window.location.href).href },
        { "@type": "ListItem", position: 2, name: "Tienda", item: new URL("tienda.html", window.location.href).href },
        { "@type": "ListItem", position: 3, name: product.name, item: productUrl }
      ]
    };
    [structuredProduct, breadcrumb].forEach((data) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });
  };

  const showNotFound = () => {
    content.hidden = true;
    notFound.hidden = false;
    document.title = "Producto no encontrado — CIMA";
  };

  if (!product) {
    showNotFound();
    return;
  }

  const category = (window.CATEGORIES || []).find((item) => item.id === product.category);
  const categoryLabel = category ? category.name : "Bazar";
  const description = product.shortDescription || categoryLabel + " de CIMA.";

  content.hidden = false;
  document.body.classList.add("has-product-bottom-bar");
  document.querySelector("[data-product-category]").textContent = categoryLabel;
  document.querySelector("[data-product-category-label]").textContent = categoryLabel;
  document.querySelector("[data-product-name]").textContent = product.name;
  document.querySelector("[data-product-sku]").textContent = product.sku;
  document.querySelector("[data-product-short-description]").textContent = description;
  document.querySelector("[data-product-description]").replaceChildren();
  renderDescription(product.description || "<p>" + description + "</p>", document.querySelector("[data-product-description]"));
  document.title = product.name + " — CIMA";
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('meta[property="og:title"]').content = product.name + " — CIMA";
  document.querySelector('meta[property="og:description"]').content = description;
  document.querySelector('meta[property="og:image"]')?.remove();
  const ogImage = document.createElement("meta");
  ogImage.setAttribute("property", "og:image");
  ogImage.content = new URL(product.images[0], window.location.href).href;
  document.head.appendChild(ogImage);

  renderGallery();
  renderBadges();
  renderPrice();
  renderStock();
  renderVariants();
  renderSpecifications();
  renderShippingOptions();
  renderRelated();
  renderStructuredData(category);
  bottomBar.hidden = false;
  refreshWhatsAppLinks();
  updateShipping();

  document.querySelector("[data-gallery-previous]").addEventListener("click", () => showImage(selectedImage - 1));
  document.querySelector("[data-gallery-next]").addEventListener("click", () => showImage(selectedImage + 1));
  quantityInput.addEventListener("input", () => {
    const quantity = Math.max(1, Math.min(product.stock || 1, Math.floor(Number(quantityInput.value) || 1)));
    quantityInput.value = String(quantity);
    refreshWhatsAppLinks();
    updateShipping();
  });
  [addButton, mobileAddButton].forEach((button) => {
    button.disabled = product.stock <= 0;
    button.addEventListener("click", addToCart);
  });
  shippingSelect.addEventListener("change", updateShipping);

  let touchStartX = null;
  imageElement.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  imageElement.addEventListener("touchend", (event) => {
    if (touchStartX == null) return;
    const difference = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(difference) > 45) showImage(selectedImage + (difference < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  document.querySelectorAll("[data-wa]").forEach((link) => {
    const phone = config.contact && config.contact.whatsapp;
    if (!phone) {
      link.hidden = true;
      return;
    }
    link.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(link.dataset.wa);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
})();
