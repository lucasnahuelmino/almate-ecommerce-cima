/* ==========================================================================
   layout.js — Rellena header y footer con los datos de STORE_CONFIG
   --------------------------------------------------------------------------
   El HTML de header/footer es estático (buena práctica de SEO), pero los
   datos (nombre, WhatsApp, horario, etc.) viven en config.js. Este script
   une ambas cosas: busca en el HTML los marcadores data-* y los rellena.

   Cómo se usa en el HTML:
     <span data-store="brand.tagline"></span>        → texto desde config
     <img data-store-src="brand.logo">               → src desde config
     <a data-store-href="brand.logo">                → href desde config
     <img data-store-alt="brand.name">               → alt desde config
     <li data-store-if="contact.address">...</li>    → se OCULTA si está vacío

   Enlaces especiales (se arman solos desde config):
     <a data-wa="Hola, quiero consultar">            → https://wa.me/NUMERO?text=...
     <a data-ig></a>                                 → https://instagram.com/USUARIO
     <a data-mail></a>                               → mailto:EMAIL
   ========================================================================== */

(function () {
  "use strict";

  const cfg = window.STORE_CONFIG;
  if (!cfg) return;

  const themeKey = "cima-theme";
  const themeToggle = document.createElement("button");
  const headerActions = document.querySelector(".header-actions");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let savedTheme = "";

  try {
    savedTheme = window.localStorage.getItem(themeKey) || "";
  } catch (error) {
    console.error("No se pudo leer la preferencia de tema.", error);
  }

  const systemPrefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  let isDark = savedTheme === "dark" || (savedTheme !== "light" && systemPrefersDark);

  const updateTheme = () => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", "Modo oscuro");
    themeToggle.title = isDark ? "Modo oscuro activo" : "Modo claro activo";
    if (themeMeta) themeMeta.setAttribute("content", isDark ? "#191510" : "#FAF7F2");
  };

  if (headerActions) {
    themeToggle.type = "button";
    themeToggle.className = "btn btn--ghost btn--icon theme-toggle";
    themeToggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>' +
      '</svg>';
    themeToggle.addEventListener("click", () => {
      isDark = !isDark;
      updateTheme();
      try {
        window.localStorage.setItem(themeKey, isDark ? "dark" : "light");
      } catch (error) {
        console.error("No se pudo guardar la preferencia de tema.", error);
      }
    });
    headerActions.insertBefore(themeToggle, headerActions.firstChild);
  }

  updateTheme();

  /** Lee una ruta puntual del config: getPath("contact.email") */
  const getPath = (path) =>
    path.split(".").reduce((obj, key) => (obj == null ? undefined : obj[key]), cfg);

  /** Elementos con data-store="ruta" → texto (escapado, seguro contra XSS) */
  document.querySelectorAll("[data-store]").forEach((el) => {
    const value = getPath(el.getAttribute("data-store"));
    if (value != null && value !== "") {
      el.textContent = value;
    }
  });

  /** data-store-if="ruta" → si el valor está vacío, se oculta el elemento */
  document.querySelectorAll("[data-store-if]").forEach((el) => {
    const value = getPath(el.getAttribute("data-store-if"));
    if (value == null || value === "" || value === false) {
      el.hidden = true;
    }
  });

  /** data-store-href / data-store-alt / data-store-content */
  document.querySelectorAll("[data-store-href]").forEach((el) => {
    const value = getPath(el.getAttribute("data-store-href"));
    if (value) el.setAttribute("href", value);
  });

  document.querySelectorAll("[data-store-src]").forEach((el) => {
    const value = getPath(el.getAttribute("data-store-src"));
    if (value) el.setAttribute("src", value);
  });

  document.querySelectorAll("[data-store-alt]").forEach((el) => {
    const value = getPath(el.getAttribute("data-store-alt"));
    if (value) el.setAttribute("alt", value);
  });

  /* ---------- Enlace WhatsApp ---------- */
  const waNumber = (cfg.contact && cfg.contact.whatsapp) || "";
  document.querySelectorAll("[data-wa]").forEach((el) => {
    if (!waNumber) { el.hidden = true; return; }
    const message = el.getAttribute("data-wa") || "Hola, quiero hacer una consulta.";
    el.setAttribute("href", "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(message));
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  });

  /* ---------- Enlace Instagram ---------- */
  const igUser = (cfg.contact && cfg.contact.instagram) || "";
  document.querySelectorAll("[data-ig]").forEach((el) => {
    if (!igUser) { el.hidden = true; return; }
    el.setAttribute("href", "https://instagram.com/" + igUser);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  });

  /* ---------- Enlace Email ---------- */
  const mail = (cfg.contact && cfg.contact.email) || "";
  document.querySelectorAll("[data-mail]").forEach((el) => {
    if (!mail) { el.hidden = true; return; }
    el.setAttribute("href", "mailto:" + mail);
    el.textContent = mail;
  });
})();
