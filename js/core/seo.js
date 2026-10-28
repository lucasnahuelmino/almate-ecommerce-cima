/* ==========================================================================
   seo.js — Canonical, Open Graph y datos estructurados (Etapa 10A)
   --------------------------------------------------------------------------
   Se carga en TODAS las páginas públicas, justo después de config.js.
   Qué hace:
   • <link rel="canonical">: le dice a Google cuál es la URL oficial de la
     página (evita que "?" de filtros o de productos se tome como duplicados).
   • og:url + og:image (+ medidas): para que al compartir en WhatsApp o
     Instagram aparezca la tarjeta con la imagen de la tienda.
   • JSON-LD Organization: datos de la marca para Google.
   La URL base sale de STORE_CONFIG.site.url; si sigue en placeholder (o el
   sitio se abrió con doble clic, protocolo file://) se usa la dirección
   actual, así nunca se publica una URL rota.
   ========================================================================== */
(() => {
  "use strict";

  const config = window.STORE_CONFIG || {};
  const PLACEHOLDER = "TU-DOMINIO.example";
  const configured = String((config.site && config.site.url) || "");
  const origin = window.location.origin;

  // URL base: dominio real configurado, o el origen actual si es http(s).
  const base = /^https?:\/\//i.test(configured) && !configured.includes(PLACEHOLDER)
    ? configured.replace(/\/+$/, "")
    : (origin && origin !== "null" ? origin : "");

  // Sin base (file:// o placeholder sin servidor): no se emiten URL absolutas.
  if (!base) return;

  /* ---------- Helpers ---------- */

  const upsertMeta = (attr, key, content) => {
    let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };

  /* ---------- URL canónica de la página ---------- */

  // Reglas:
  // • producto.html conserva ?slug= (cada producto es una página propia).
  // • El resto se limpia de parámetros (filtros de tienda, ?order=, etc.).
  const canonicalUrl = () => {
    const url = new URL(window.location.href);
    let path = url.pathname;
    if (path.endsWith("/index.html")) path = path.slice(0, -"index.html".length);
    const keepQuery = path.endsWith("/producto.html") && url.searchParams.has("slug");
    const query = keepQuery ? `?slug=${encodeURIComponent(url.searchParams.get("slug"))}` : "";
    return `${base}${path}${query}`;
  };

  const pageUrl = canonicalUrl();

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = pageUrl;
  else {
    const link = document.createElement("link");
    link.rel = "canonical";
    link.href = pageUrl;
    document.head.appendChild(link);
  }

  /* ---------- Open Graph (tarjeta al compartir) ---------- */

  const brand = config.brand || {};
  const siteName = [brand.name, brand.tagline].filter(Boolean).join(" — ");

  upsertMeta("property", "og:url", pageUrl);
  upsertMeta("property", "og:image", `${base}/assets/og-image.png`);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("property", "og:site_name", siteName);

  /* ---------- Datos estructurados: Organization ---------- */

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name || "CIMA",
    url: base,
    logo: `${base}/${brand.logo || "assets/logo.svg"}`
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(organization);
  document.head.appendChild(script);
})();
