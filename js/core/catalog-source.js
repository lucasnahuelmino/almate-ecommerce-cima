(() => {
  "use strict";

  const config = window.STORE_CONFIG || {};
  const configuredBaseUrl = config.catalog && config.catalog.apiBaseUrl ||
    config.payments && config.payments.apiBaseUrl || "";
  const baseUrl = configuredBaseUrl ? String(configuredBaseUrl).replace(/\/+$/, "") : "";
  let status = baseUrl ? "loading" : "static";

  const showCatalogError = () => {
    const notice = document.createElement("p");
    notice.className = "notice notice--error";
    notice.setAttribute("role", "alert");
    notice.textContent = "No pudimos actualizar el catálogo. No se mostrarán precios ni stock hasta recuperar la conexión.";
    const main = document.querySelector("main");
    (main || document.body).prepend(notice);
  };

  const ready = baseUrl
    ? fetch(baseUrl + "/api/products", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("La API de catálogo respondió " + response.status + ".");
        return response.json();
      })
      .then((result) => {
        if (!Array.isArray(result.products) || !Array.isArray(result.categories)) {
          throw new Error("La respuesta de catálogo tiene un formato inválido.");
        }
        window.PRODUCTS = result.products;
        window.CATEGORIES = result.categories;
        status = "remote";
        window.dispatchEvent(new CustomEvent("catalog:ready"));
      })
      .catch((error) => {
        window.PRODUCTS = [];
        window.CATEGORIES = [];
        status = "error";
        console.error("No se pudo actualizar el catálogo remoto.", error);
        showCatalogError();
        window.dispatchEvent(new CustomEvent("catalog:ready"));
      })
    : Promise.resolve();

  window.CatalogSource = { ready, get status() { return status; } };
})();
