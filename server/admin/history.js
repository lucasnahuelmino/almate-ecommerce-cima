/* ==========================================================================
   history.js — Historial de acciones del panel (Etapa 5)
   --------------------------------------------------------------------------
   Lista las acciones registradas (fecha, acción, detalle, resultado) y
   permite revertir los cambios de precio/stock guardados en el registro.
   • Todo se renderiza con textContent (addText): nada de HTML del servidor.
   • La reversión pide confirmación y restaura EXACTAMENTE lo que el registro
     guardó (el servidor revalida: precio en rango y stock sobre reservas).
   Usa los helpers compartidos de admin.js (window.AdminCore).
   ========================================================================== */
(() => {
  "use strict";

  const core = window.AdminCore;
  if (!core) return;

  const historyPanel = document.querySelector("[data-history-panel]");
  const historyMessage = document.querySelector("[data-history-message]");
  const rowsBody = document.querySelector("[data-history-rows]");
  const emptyState = document.querySelector("[data-history-empty]");
  const pageInfo = document.querySelector("[data-history-info]");
  const prevButton = document.querySelector("[data-history-prev]");
  const nextButton = document.querySelector("[data-history-next]");

  const pageSize = 25;
  let offset = 0;
  let started = false;

  const showMessage = (text, kind = "ok") => {
    historyMessage.textContent = text;
    historyMessage.dataset.kind = kind;
    historyMessage.hidden = !text;
  };

  const resultBadge = (entry) => {
    const badge = document.createElement("span");
    badge.className = `tag ${entry.result === "ok" ? "tag--ok" : "tag--error"}`;
    badge.textContent = entry.result === "ok" ? "OK" : "Error";
    return badge;
  };

  /* ---------- Reversión ---------- */

  const revertEntry = async (entry) => {
    const confirmed = window.confirm(
      `¿Revertir esta acción?\n\n${entry.summary}\n\n` +
      "Se restauran SOLO los cambios de precio o stock que guardó el registro."
    );
    if (!confirmed) return;
    try {
      const result = await core.request(
        `/api/admin/audit/${encodeURIComponent(entry.id)}/revert`,
        { method: "POST" }
      );
      // El catálogo y el historial mostraban valores viejos: el evento
      // dispara la recarga de ambas secciones (la recarga limpia el mensaje,
      // por eso se muestra DESPUÉS de despacharla).
      window.dispatchEvent(new CustomEvent("admin:catalog-changed"));
      showMessage(`Listo: se revirtió(n) ${result.reverted} cambio(s) de precio/stock.`);
    } catch (error) {
      showMessage(error.message, "error");
    }
  };

  /* ---------- Filas ---------- */

  const renderRow = (entry) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = core.formatDate(entry.createdAt);
    row.appendChild(dateCell);

    const actionCell = document.createElement("td");
    actionCell.appendChild(core.addText(document.createElement("strong"), "strong", entry.label));
    row.appendChild(actionCell);

    const detailCell = document.createElement("td");
    detailCell.className = "history-table__detail";
    detailCell.textContent = entry.summary || "—";
    row.appendChild(detailCell);

    const resultCell = document.createElement("td");
    resultCell.appendChild(resultBadge(entry));
    row.appendChild(resultCell);

    const revertCell = document.createElement("td");
    if (entry.revertible) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button--secondary button--small";
      button.textContent = "Deshacer";
      button.addEventListener("click", () => revertEntry(entry));
      revertCell.appendChild(button);
    } else {
      const hint = core.addText(document.createElement("span"), "span", "—");
      hint.className = "muted";
      revertCell.appendChild(hint);
    }
    row.appendChild(revertCell);

    return row;
  };

  /* ---------- Carga ---------- */

  const loadHistory = async () => {
    historyMessage.hidden = true;
    const result = await core.request(
      `/api/admin/audit?limit=${pageSize}&offset=${offset}`
    );
    rowsBody.replaceChildren();
    result.entries.forEach((entry) => rowsBody.appendChild(renderRow(entry)));
    emptyState.hidden = result.entries.length > 0;
    const from = result.total ? offset + 1 : 0;
    const to = Math.min(offset + result.entries.length, result.total);
    pageInfo.textContent = `${from}–${to} de ${result.total}`;
    prevButton.disabled = offset === 0;
    nextButton.disabled = offset + pageSize >= result.total;
  };

  const start = () => {
    started = true;
    loadHistory().catch((error) => showMessage(error.message, "error"));
  };

  prevButton.addEventListener("click", () => {
    offset = Math.max(0, offset - pageSize);
    loadHistory().catch((error) => showMessage(error.message, "error"));
  });

  nextButton.addEventListener("click", () => {
    offset += pageSize;
    loadHistory().catch((error) => showMessage(error.message, "error"));
  });

  window.addEventListener("admin:ready", () => {
    if (core.currentSection === "history" && !started) start();
  });

  window.addEventListener("admin:section", (event) => {
    if (event.detail && event.detail.section === "history") start();
  });

  // Cada edición u operación masiva agrega una entrada: si estamos en la
  // sección, recargamos para mostrarla.
  window.addEventListener("admin:catalog-changed", () => {
    if (started && !historyPanel.hidden) {
      loadHistory().catch((error) => showMessage(error.message, "error"));
    }
  });
})();
