/* ==========================================================================
   catalog.js — Búsqueda, filtros y orden del catálogo
   ========================================================================== */

window.Catalog = (function () {
  "use strict";

  const normalize = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-AR")
      .trim();

  const getCategory = (product) =>
    (window.CATEGORIES || []).find((category) => category.id === product.category);

  const isOffer = (product) =>
    product.comparePrice > product.price ||
    (Array.isArray(product.tags) && product.tags.includes("oferta"));

  const matchesQuery = (product, query) => {
    if (!query) return true;
    const category = getCategory(product);
    const searchable = [
      product.name,
      product.shortDescription,
      product.description,
      product.sku,
      product.category,
      product.subcategory,
      category && category.name,
      ...(Array.isArray(product.tags) ? product.tags : [])
    ].join(" ");
    return normalize(searchable).includes(normalize(query));
  };

  const filter = (products, state) => {
    const query = state.query || "";
    const category = state.category || "";
    const tags = state.tags || [];
    const min = Number.isFinite(state.min) ? state.min : null;
    const max = Number.isFinite(state.max) ? state.max : null;

    return products.filter((product) => {
      if (!product.active || !matchesQuery(product, query)) return false;
      if (category && product.category !== category) return false;
      if (state.available && product.stock <= 0) return false;
      if (min != null && product.price < min) return false;
      if (max != null && product.price > max) return false;
      if (tags.includes("oferta") && !isOffer(product)) return false;
      if (tags.includes("nuevo") && !(product.tags || []).includes("nuevo")) return false;
      return true;
    });
  };

  const sort = (products, sortBy) => {
    const sorted = products.slice();
    const byRelevance = (a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      Number(b.stock > 0) - Number(a.stock > 0);

    if (sortBy === "price-asc") return sorted.sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") return sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "newest") {
      return sorted.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || byRelevance(a, b)
      );
    }
    if (sortBy === "discount") {
      const discount = (product) =>
        product.comparePrice > product.price
          ? (product.comparePrice - product.price) / product.comparePrice
          : 0;
      return sorted.sort((a, b) => discount(b) - discount(a) || byRelevance(a, b));
    }
    return sorted.sort(byRelevance);
  };

  const getSuggestions = (products) =>
    products.filter((product) => product.active).map((product) => ({
      name: product.name,
      sku: product.sku
    }));

  return { filter, sort, getSuggestions, isOffer };
})();
