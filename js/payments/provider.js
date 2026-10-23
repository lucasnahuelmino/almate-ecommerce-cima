/* ==========================================================================
   provider.js — Registro de proveedores de pago
   ========================================================================== */

(function () {
  "use strict";

  const providers = new Map();

  const register = (provider) => {
    if (!provider || typeof provider.id !== "string" ||
        typeof provider.createCheckout !== "function" ||
        typeof provider.handleReturn !== "function") {
      throw new TypeError("El proveedor de pago no implementa la interfaz requerida.");
    }
    providers.set(provider.id, provider);
  };

  const get = (id) => {
    const provider = providers.get(id);
    if (!provider) throw new Error("No hay un proveedor de pago configurado para: " + id);
    return provider;
  };

  window.PaymentProvider = { register, get };
})();
