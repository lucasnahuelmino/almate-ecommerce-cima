/* ==========================================================================
   header.js — Comportamiento del header
   --------------------------------------------------------------------------
   • Menú mobile (abre/cierra el sheet).
   • Buscador mobile (muestra/oculta la barra).
   • Búsqueda por teclado → redirige a tienda.html?q=...
   • Header compacto al hacer scroll.
   • Resalta la página actual en el menú (aria-current="page").
   • Actualiza el contador del carrito (si hay datos de carrito, Etapa 7).
   ========================================================================== */

(function () {
  "use strict";

  const $ = window.Utils.$;
  const $$ = window.Utils.$$;

  /* ---------- Navegación destacada según la página actual ---------- */
  const markCurrentPage = () => {
    const currentUrl = new URL(window.location.href);
    const path = currentUrl.pathname.split("/").pop() || "index.html";
    const isOfferListing = currentUrl.searchParams.getAll("tag").includes("oferta");
    $$(".main-nav__link, .menu-sheet__link").forEach((link) => {
      const linkUrl = new URL(link.href, currentUrl);
      const isOfferLink = linkUrl.searchParams.get("tag") === "oferta";
      const linkPath = linkUrl.pathname.split("/").pop();
      if (linkPath === path && (isOfferLink ? isOfferListing : !isOfferListing)) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  /* ---------- Menú mobile ---------- */
  const menuToggle = $("[data-menu-toggle]");
  const menuSheet = $("#menu-sheet");

  const setMenu = (open) => {
    if (!menuToggle || !menuSheet) return;
    menuSheet.classList.toggle("is-open", open);
    menuSheet.setAttribute("aria-hidden", String(!open));
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    // Cambia el ícono hamburguesa ↔ X
    const menuIcon = menuToggle.querySelector(".icon-menu");
    const closeIcon = menuToggle.querySelector(".icon-close");
    if (menuIcon) menuIcon.hidden = open;
    if (closeIcon) closeIcon.hidden = !open;
    // Bloquea el scroll del fondo mientras el menú está abierto
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      window.setTimeout(() => {
        if (menuSheet.classList.contains("is-open")) {
          menuSheet.querySelector("a")?.focus();
        }
      }, 0);
    }
  };

  if (menuToggle && menuSheet) {
    menuToggle.addEventListener("click", () => {
      setMenu(!menuSheet.classList.contains("is-open"));
    });
    // Cerrar al elegir un enlace
    menuSheet.addEventListener("click", (e) => {
      if (e.target.closest("a")) setMenu(false);
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cart-open]") && menuSheet && menuSheet.classList.contains("is-open")) {
      setMenu(false);
    }
  });

  /* ---------- Buscador mobile ---------- */
  const searchToggle = $("[data-search-toggle]");
  const searchMobile = $("#search-mobile");

  if (searchToggle && searchMobile) {
    searchToggle.addEventListener("click", () => {
      const open = searchMobile.classList.toggle("is-open");
      searchToggle.setAttribute("aria-expanded", String(open));
      searchToggle.setAttribute("aria-label", open ? "Ocultar búsqueda" : "Mostrar búsqueda");
      if (open) searchMobile.querySelector("input")?.focus();
    });
  }

  /* ---------- Búsqueda (desktop y mobile) ---------- */
  const goToSearch = (query) => {
    const q = (query || "").trim();
    if (!q) return;
    window.location.href = "tienda.html?q=" + encodeURIComponent(q);
  };

  $$(".js-search-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      goToSearch(form.querySelector("input")?.value);
    });
  });

  /* ---------- Header compacto al hacer scroll ---------- */
  const header = $("#site-header");
  if (header) {
    let lastState = false;
    window.addEventListener(
      "scroll",
      () => {
        const compact = window.scrollY > 24;
        if (compact !== lastState) {
          header.classList.toggle("is-compact", compact);
          lastState = compact;
        }
      },
      { passive: true }
    );
  }

  /* ---------- Escape cierra menú y buscador ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (menuSheet && menuSheet.classList.contains("is-open")) {
        setMenu(false);
        menuToggle?.focus();
      }
      if (searchMobile && searchMobile.classList.contains("is-open")) {
        searchMobile.classList.remove("is-open");
        searchToggle.setAttribute("aria-expanded", "false");
        searchToggle.setAttribute("aria-label", "Mostrar búsqueda");
        searchToggle.focus();
      }
      return;
    }

    if (e.key !== "Tab" || !menuSheet || !menuSheet.classList.contains("is-open")) return;
    const focusable = $$('a[href], button:not([disabled])', menuSheet)
      .filter((el) => el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ---------- Contador del carrito ----------
     En la Etapa 7, window.Cart expone getCount(). Si todavía no existe,
     el contador queda en 0 sin romper nada. */
  const countEl = $("[data-cart-count]");

  const refreshCount = (bump) => {
    if (!countEl) return;
    const count = window.Cart && typeof window.Cart.getCount === "function"
      ? window.Cart.getCount()
      : 0;
    countEl.textContent = String(count);
    countEl.hidden = count === 0;
    if (bump && count > 0) {
      countEl.classList.remove("is-bump");
      // Reinicia la animación para que se dispare de nuevo
      void countEl.offsetWidth;
      countEl.classList.add("is-bump");
    }
  };

  // API pública: otros módulos pueden llamarlo tras agregar/quitar ítems
  window.refreshCartCount = refreshCount;
  refreshCount(false);

  markCurrentPage();
})();
