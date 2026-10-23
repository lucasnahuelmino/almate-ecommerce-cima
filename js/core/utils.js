/* ==========================================================================
   utils.js — Funciones de utilidad globales (window.Utils)
   --------------------------------------------------------------------------
   Helpers que usan todas las páginas. Están en un solo lugar para no
   repetir código. Se cargan con <script defer> y quedan disponibles como
   window.Utils.*
   ========================================================================== */

window.Utils = (function () {
  "use strict";

  /** Selecciona UN elemento del DOM: $(".mi-clase") */
  const $ = (selector, root) => (root || document).querySelector(selector);

  /** Selecciona VARIOS elementos y devuelve un arreglo: $$(".mi-clase") */
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  /**
   * Formatea un precio en pesos argentinos.
   * formatPrice(89900) → "$ 89.900"
   * Usa la configuración de moneda de STORE_CONFIG.
   */
  const formatPrice = (amount) => {
    const cfg = (window.STORE_CONFIG && window.STORE_CONFIG.currency) || {};
    try {
      return new Intl.NumberFormat(cfg.locale || "es-AR", {
        style: "currency",
        currency: cfg.code || "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      // Fallback simple si el navegador no soporta Intl
      return "$ " + Number(amount).toLocaleString("es-AR");
    }
  };

  /** Convierte 89900 → "89.900" (sin símbolo), para textos tipo "Subtotal $ 89.900" */
  const formatNumber = (amount) => {
    const cfg = (window.STORE_CONFIG && window.STORE_CONFIG.currency) || {};
    return Number(amount).toLocaleString(cfg.locale || "es-AR", { maximumFractionDigits: 0 });
  };

  /**
   * Escapa texto para insertarlo en el DOM sin riesgo de XSS.
   * SIEMPRE usar cuando el texto venga del usuario o de datos.
   */
  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  /** "Set de ollas 8 piezas!" → "set-de-ollas-8-piezas" */
  const slugify = (text) =>
    String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // quita tildes
      .replace(/[^a-z0-9\s-]/g, "")      // quita símbolos raros
      .trim()
      .replace(/\s+/g, "-");             // espacios → guiones

  /** Espera a que el usuario deje de escribir antes de ejecutar fn (búsquedas) */
  const debounce = (fn, wait) => {
    let timer;
    const waitMs = wait == null ? 300 : wait;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), waitMs);
    };
  };

  /** Lee un parámetro de la URL: getParam("slug") en ?slug=olla → "olla" */
  const getParam = (name) => new URLSearchParams(window.location.search).get(name);

  /** Genera un id corto de pedido, ej. "CIMA-8F3K2" */
  const generateOrderId = () => {
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return "CIMA-" + rand;
  };

  return {
    $,
    $$,
    formatPrice,
    formatNumber,
    escapeHtml,
    slugify,
    debounce,
    getParam,
    generateOrderId
  };
})();
