/* ==========================================================================
   support.js — Datos configurables de ayuda y solicitud de arrepentimiento
   ========================================================================== */

(function () {
  "use strict";

  const config = window.STORE_CONFIG || {};
  const formatPrice = window.Utils.formatPrice;
  const zoneList = document.querySelector("[data-support-shipping-zones]");
  const shipping = config.shipping || {};

  if (zoneList) {
    const options = [];
    if (shipping.pickup && shipping.pickup.enabled) {
      options.push({
        label: shipping.pickup.label,
        description: "Costo: " + formatPrice(Number(shipping.pickup.cost) || 0) + ". Coordinamos el punto por WhatsApp."
      });
    }
    (shipping.zones || []).forEach((zone) => {
      options.push({
        label: zone.label,
        description: "Costo estimado: " + formatPrice(Number(zone.cost) || 0) + ". Se confirma al coordinar el pedido."
      });
    });

    options.forEach((option) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = option.label;
      const description = document.createElement("p");
      description.textContent = option.description;
      item.append(title, description);
      zoneList.appendChild(item);
    });
  }

  document.querySelectorAll("[data-free-shipping-from]").forEach((element) => {
    const amount = Number(shipping.freeShippingFrom);
    element.textContent = amount > 0
      ? "En pedidos desde " + formatPrice(amount) + " el envío a las zonas habilitadas puede ser sin cargo. Confirmamos la cobertura al coordinar la compra."
      : "Consultanos si hay promociones de envío sin cargo para tu zona.";
  });

  document.querySelectorAll("[data-contact-schedule]").forEach((element) => {
    element.textContent = config.contact && config.contact.schedule
      ? config.contact.schedule
      : "Consultanos por nuestros horarios de atención.";
  });

  const form = document.querySelector("[data-withdrawal-form]");
  if (form) {
    const feedback = document.querySelector("[data-withdrawal-feedback]");
    const fallback = document.querySelector("[data-withdrawal-fallback]");
    const fallbackLink = document.querySelector("[data-withdrawal-whatsapp]");
    const phone = config.contact && config.contact.whatsapp;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      feedback.hidden = true;
      if (!phone) {
        feedback.textContent = "No está disponible el canal de WhatsApp. Escribinos por email para recibir ayuda.";
        feedback.hidden = false;
        return;
      }

      const data = new FormData(form);
      const message = [
        "Hola, quiero iniciar una solicitud vinculada a una compra a distancia.",
        "Nombre: " + String(data.get("name")).trim(),
        "Email: " + String(data.get("email")).trim(),
        data.get("order") ? "Número de pedido: " + String(data.get("order")).trim() : "",
        "Solicitud: " + String(data.get("details")).trim(),
        "",
        "Por favor, confirmen la recepción de este mensaje y los pasos a seguir."
      ].filter(Boolean).join("\n");
      const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
      const popup = window.open("about:blank", "_blank");

      if (popup) {
        popup.opener = null;
        popup.location.href = url;
        fallback.hidden = true;
        feedback.textContent = "Se abrió WhatsApp. Revisá el mensaje y envialo para que recibamos tu solicitud.";
        feedback.hidden = false;
        return;
      }

      fallbackLink.href = url;
      fallback.hidden = false;
      feedback.textContent = "El navegador bloqueó la nueva pestaña. Usá el botón de abajo para continuar en WhatsApp.";
      feedback.hidden = false;
      fallbackLink.focus();
    });
  }
})();
