/* ==========================================================================
   shop.js — Interfaz del catálogo con filtros reflejados en la URL
   ========================================================================== */

(function () {
  "use strict";

  const products = window.PRODUCTS || [];
  const categories = (window.CATEGORIES || []).filter((category) => !category.isVirtual);
  const pageSize = 8;
  const allowedSorts = ["relevance", "price-asc", "price-desc", "newest", "discount"];
  const params = new URLSearchParams(window.location.search);
  const queryInput = document.querySelector("[data-filter-query]");
  const categoryInput = document.querySelector("[data-filter-category]");
  const minInput = document.querySelector("[data-filter-min]");
  const maxInput = document.querySelector("[data-filter-max]");
  const stockInput = document.querySelector("[data-filter-stock]");
  const sortInput = document.querySelector("[data-filter-sort]");
  const tagInputs = Array.from(document.querySelectorAll("[data-filter-tag]"));
  const grid = document.querySelector("[data-product-grid]");
  const count = document.querySelector("[data-result-count]");
  const emptyState = document.querySelector("[data-empty-state]");
  const pagination = document.querySelector("[data-pagination]");
  const activeFilters = document.querySelector("[data-active-filters]");

  const state = {
    query: params.get("q") || "",
    category: params.get("category") || "",
    min: params.has("min") ? Number(params.get("min")) : null,
    max: params.has("max") ? Number(params.get("max")) : null,
    available: params.get("stock") === "available",
    tags: params.getAll("tag").filter((tag) => ["oferta", "nuevo"].includes(tag)),
    sort: allowedSorts.includes(params.get("sort")) ? params.get("sort") : "relevance",
    page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1)
  };

  const normalizeCategory = (value) => {
    const category = categories.find((item) => item.id === value || item.slug === value);
    return category ? category.id : "";
  };

  state.category = normalizeCategory(state.category);
  if (!Number.isFinite(state.min) || state.min < 0) state.min = null;
  if (!Number.isFinite(state.max) || state.max < 0) state.max = null;

  const fillCategoryOptions = () => {
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categoryInput.appendChild(option);
    });
  };

  const fillSuggestions = () => {
    const datalist = document.querySelector("[data-search-suggestions]");
    window.Catalog.getSuggestions(products).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.label = item.sku;
      datalist.appendChild(option);
    });
  };

  const readStateFromControls = () => {
    state.query = queryInput.value.trim();
    state.category = categoryInput.value;
    state.min = minInput.value === "" ? null : Math.max(0, Number(minInput.value));
    state.max = maxInput.value === "" ? null : Math.max(0, Number(maxInput.value));
    state.available = stockInput.checked;
    state.tags = tagInputs.filter((input) => input.checked).map((input) => input.value);
    state.sort = sortInput.value;
  };

  const syncControls = () => {
    queryInput.value = state.query;
    categoryInput.value = state.category;
    minInput.value = state.min == null ? "" : String(state.min);
    maxInput.value = state.max == null ? "" : String(state.max);
    stockInput.checked = state.available;
    sortInput.value = state.sort;
    tagInputs.forEach((input) => {
      input.checked = state.tags.includes(input.value);
    });
  };

  const updateUrl = (method) => {
    const next = new URL(window.location.href);
    ["q", "category", "min", "max", "stock", "tag", "sort", "page"].forEach((key) => {
      next.searchParams.delete(key);
    });

    if (state.query) next.searchParams.set("q", state.query);
    if (state.category) next.searchParams.set("category", state.category);
    if (state.min != null) next.searchParams.set("min", String(state.min));
    if (state.max != null) next.searchParams.set("max", String(state.max));
    if (state.available) next.searchParams.set("stock", "available");
    state.tags.forEach((tag) => next.searchParams.append("tag", tag));
    if (state.sort !== "relevance") next.searchParams.set("sort", state.sort);
    if (state.page > 1) next.searchParams.set("page", String(state.page));

    window.history[method + "State"]({}, "", next.href);
  };

  const createProductCard = (product, index) => {
    const category = categories.find((item) => item.id === product.category);
    const card = document.createElement("article");
    card.className = "card catalog-card";

    const media = document.createElement("div");
    media.className = "card__media";
    const image = document.createElement("img");
    image.src = product.images && product.images[0] ? product.images[0] : "";
    image.alt = product.name;
    image.loading = index < 2 ? "eager" : "lazy";
    image.decoding = "async";
    if (index === 0) image.fetchPriority = "high";
    media.appendChild(image);

    const discount = window.Catalog.isOffer(product) && product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;
    const badges = document.createElement("div");
    badges.className = "card__badges";
    if (discount) {
      const offerBadge = document.createElement("span");
      offerBadge.className = "badge badge--offer";
      offerBadge.textContent = "-" + discount + "%";
      badges.appendChild(offerBadge);
    } else if (window.Catalog.isOffer(product)) {
      const offerBadge = document.createElement("span");
      offerBadge.className = "badge badge--offer";
      offerBadge.textContent = "Oferta";
      badges.appendChild(offerBadge);
    }
    if ((product.tags || []).includes("nuevo")) {
      const newBadge = document.createElement("span");
      newBadge.className = "badge badge--new";
      newBadge.textContent = "Nuevo";
      badges.appendChild(newBadge);
    }
    if (product.stock <= 0) {
      const soldOutBadge = document.createElement("span");
      soldOutBadge.className = "badge badge--sold-out";
      soldOutBadge.textContent = "Agotado";
      badges.appendChild(soldOutBadge);
    }
    if (badges.childElementCount) media.appendChild(badges);

    const body = document.createElement("div");
    body.className = "card__body";
    const categoryLabel = document.createElement("p");
    categoryLabel.className = "card__category";
    categoryLabel.textContent = category ? category.name : "Bazar";

    const title = document.createElement("h3");
    title.className = "card__title";
    const titleLink = document.createElement("a");
    titleLink.href = "producto.html?slug=" + encodeURIComponent(product.slug);
    titleLink.textContent = product.name;
    title.appendChild(titleLink);

    const price = document.createElement("p");
    price.className = "price";
    const currentPrice = document.createElement("span");
    currentPrice.textContent = window.Utils.formatPrice(product.price);
    price.appendChild(currentPrice);
    if (discount) {
      const previousPrice = document.createElement("span");
      previousPrice.className = "price__compare";
      previousPrice.textContent = window.Utils.formatPrice(product.comparePrice);
      price.appendChild(previousPrice);
    }

    const bodyFooter = document.createElement("div");
    bodyFooter.className = "catalog-card__footer";
    const stock = document.createElement("span");
    stock.className = product.stock <= 0
      ? "catalog-stock catalog-stock--sold-out"
      : product.stock <= 3
        ? "catalog-stock catalog-stock--low"
        : "catalog-stock";
    stock.textContent = product.stock <= 0
      ? "Agotado"
      : product.stock <= 3
        ? "¡Últimas unidades!"
        : "Disponible";

    const action = document.createElement("a");
    action.className = "btn btn--outline btn--sm catalog-card__action";
    action.textContent = "Ver producto";
    action.href = "producto.html?slug=" + encodeURIComponent(product.slug);

    bodyFooter.append(stock, action);
    body.append(categoryLabel, title, price, bodyFooter);
    card.append(media, body);
    return card;
  };

  const renderActiveFilters = () => {
    activeFilters.replaceChildren();
    const labels = [];
    if (state.query) labels.push("Búsqueda: " + state.query);
    if (state.category) {
      const category = categories.find((item) => item.id === state.category);
      if (category) labels.push(category.name);
    }
    if (state.min != null) labels.push("Desde " + window.Utils.formatPrice(state.min));
    if (state.max != null) labels.push("Hasta " + window.Utils.formatPrice(state.max));
    if (state.available) labels.push("Disponibles");
    state.tags.forEach((tag) => labels.push(tag === "nuevo" ? "Nuevos" : "En oferta"));

    labels.forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "catalog-chip";
      chip.textContent = label;
      activeFilters.appendChild(chip);
    });
  };

  const renderPagination = (totalPages) => {
    pagination.replaceChildren();
    if (totalPages <= 1) return;

    const addPageButton = (page, label, isCurrent) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = isCurrent ? "catalog-page is-current" : "catalog-page";
      button.textContent = label;
      if (isCurrent) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        state.page = page;
        updateUrl("push");
        render();
        document.querySelector(".catalog-toolbar").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      pagination.appendChild(button);
    };

    if (state.page > 1) addPageButton(state.page - 1, "Anterior", false);
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === 1 || page === totalPages || Math.abs(page - state.page) <= 1) {
        addPageButton(page, String(page), page === state.page);
      }
    }
    if (state.page < totalPages) addPageButton(state.page + 1, "Siguiente", false);
  };

  const render = () => {
    const filtered = window.Catalog.sort(window.Catalog.filter(products, state), state.sort);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const requestedPage = state.page;
    state.page = Math.min(state.page, totalPages);
    if (state.page !== requestedPage) updateUrl("replace");
    const start = (state.page - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);

    grid.replaceChildren();
    visible.forEach((product, index) => grid.appendChild(createProductCard(product, index)));
    count.textContent = filtered.length
      ? "Mostrando " + (start + 1) + "–" + Math.min(start + pageSize, filtered.length) + " de " + filtered.length + " productos"
      : "No hay productos para mostrar";
    emptyState.hidden = filtered.length > 0;
    pagination.hidden = filtered.length === 0;
    renderPagination(totalPages);
    renderActiveFilters();
  };

  const updateFilters = (pushHistory) => {
    readStateFromControls();
    state.page = 1;
    updateUrl(pushHistory ? "push" : "replace");
    render();
  };

  const clearFilters = () => {
    state.query = "";
    state.category = "";
    state.min = null;
    state.max = null;
    state.available = false;
    state.tags = [];
    state.sort = "relevance";
    state.page = 1;
    syncControls();
    updateUrl("push");
    render();
  };

  fillCategoryOptions();
  fillSuggestions();
  syncControls();

  let searchTimer;
  queryInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => updateFilters(false), 250);
  });

  [categoryInput, stockInput, sortInput, ...tagInputs].forEach((input) => {
    input.addEventListener("change", () => updateFilters(false));
  });

  [minInput, maxInput].forEach((input) => {
    input.addEventListener("change", () => updateFilters(false));
  });

  document.querySelectorAll("[data-clear-filters]").forEach((button) => {
    button.addEventListener("click", clearFilters);
  });

  document.querySelectorAll(".js-search-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const input = form.querySelector("input[type='search']");
      state.query = input.value.trim();
      state.page = 1;
      syncControls();
      updateUrl("push");
      render();
      queryInput.focus();
    });
  });

  window.addEventListener("popstate", () => {
    window.clearTimeout(searchTimer);
    const next = new URLSearchParams(window.location.search);
    state.query = next.get("q") || "";
    state.category = normalizeCategory(next.get("category") || "");
    state.min = next.has("min") ? Number(next.get("min")) : null;
    state.max = next.has("max") ? Number(next.get("max")) : null;
    state.available = next.get("stock") === "available";
    state.tags = next.getAll("tag").filter((tag) => ["oferta", "nuevo"].includes(tag));
    state.sort = allowedSorts.includes(next.get("sort")) ? next.get("sort") : "relevance";
    state.page = Math.max(1, Number.parseInt(next.get("page"), 10) || 1);
    syncControls();
    render();
  });

  render();
})();
