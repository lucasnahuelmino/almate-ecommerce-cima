/* ==========================================================================
   animations.js — Revelado progresivo al hacer scroll (Etapa 10B)
   --------------------------------------------------------------------------
   Se carga en las páginas que tienen bloques con data-reveal (home, tienda,
   contacto y envíos). Cuando un bloque entra en pantalla, aparece con un
   fundido suave en lugar de "aparecer de golpe".

   Reglas de seguridad:
   • Si el navegador no tiene IntersectionObserver → no hace nada y todo se
     ve normal (sin JS el contenido NUNCA queda oculto).
   • Si la persona activó "reducir movimiento" en el sistema → no hace nada.
   • Lo que ya está en pantalla se marca como visto ANTES de ocultar nada,
     así no hay parpadeo (visible → invisible → visible) al cargar.
   ========================================================================== */
(() => {
  "use strict";

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) return;

  const elements = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!elements.length) return;

  // Separa lo que ya se ve (se marca ya, sin animación de entrada) de lo
  // que está fuera de pantalla (se observa para animar cuando aparezca).
  const pending = elements.filter((el) => {
    const rect = el.getBoundingClientRect();
    const visibleNow = rect.bottom > 0 && rect.top < window.innerHeight;
    if (visibleNow) el.classList.add("is-revealed");
    return !visibleNow;
  });

  // Recién ahora se activa el estado oculto (la clase .has-reveal).
  document.documentElement.classList.add("has-reveal");

  if (!pending.length) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        obs.unobserve(entry.target); // Una vez revelado, deja de observarse
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );

  pending.forEach((el) => observer.observe(el));
})();
