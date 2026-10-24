/* ==========================================================================
   catalog.js — Gestión visual de productos del panel
   --------------------------------------------------------------------------
   Listado con filtros, paginación y selección; formulario por secciones
   (sin JSON a mano) para crear, editar, duplicar, publicar y eliminar.
   Usa los helpers compartidos de admin.js (window.AdminCore).
   ========================================================================== */
(() => {
  "use strict";

  const core = window.AdminCore;
  if (!core) return;

  const catalogPanel = document.querySelector("[data-catalog-panel]");
  const catalogMessage = document.querySelector("[data-catalog-message]");
  const rowsBody = document.querySelector("[data-catalog-rows]");
  const emptyState = document.querySelector("[data-catalog-empty]");
  const pageInfo = document.querySelector("[data-page-info]");
  const prevButton = document.querySelector("[data-page-prev]");
  const nextButton = document.querySelector("[data-page-next]");
  const selectAll = document.querySelector("[data-select-all]");
  const bulkBar = document.querySelector("[data-bulk-bar]");
  const bulkCount = document.querySelector("[data-bulk-count]");
  const bulkPublish = document.querySelector("[data-bulk-publish]");
  const bulkUnpublish = document.querySelector("[data-bulk-unpublish]");
  const newButton = document.querySelector("[data-product-new]");

  // Operaciones masivas (Etapa 3)
  const bulkOpen = document.querySelector("[data-bulk-open]");
  const bulkOps = document.querySelector("[data-bulk-ops]");
  const bulkScopeRadios = document.querySelectorAll("[data-bulk-scope]");
  const bulkScopeCount = document.querySelector("[data-bulk-scope-count]");
  const bulkScopeCategory = document.querySelector("[data-bulk-scope-category]");
  const bulkKind = document.querySelector("[data-bulk-kind]");
  const bulkPriceFields = document.querySelector("[data-bulk-price-fields]");
  const bulkBoolFields = document.querySelector("[data-bulk-bool-fields]");
  const bulkStockFields = document.querySelector("[data-bulk-stock-fields]");
  const bulkPriceDirection = document.querySelector("[data-bulk-price-direction]");
  const bulkPriceMode = document.querySelector("[data-bulk-price-mode]");
  const bulkPriceValue = document.querySelector("[data-bulk-price-value]");
  const bulkPriceValueLabel = document.querySelector("[data-bulk-price-value-label]");
  const bulkPriceRounding = document.querySelector("[data-bulk-price-rounding]");
  const bulkBoolLabel = document.querySelector("[data-bulk-bool-label]");
  const bulkBoolValue = document.querySelector("[data-bulk-bool-value]");
  const bulkStockMode = document.querySelector("[data-bulk-stock-mode]");
  const bulkStockValue = document.querySelector("[data-bulk-stock-value]");
  const bulkStockValueLabel = document.querySelector("[data-bulk-stock-value-label]");
  const bulkPreview = document.querySelector("[data-bulk-preview]");
  const bulkApply = document.querySelector("[data-bulk-apply]");
  const bulkMessage = document.querySelector("[data-bulk-message]");
  const bulkResult = document.querySelector("[data-bulk-result]");
  const bulkSummary = document.querySelector("[data-bulk-summary]");
  const bulkResultRows = document.querySelector("[data-bulk-result-rows]");

  const form = document.querySelector("[data-product-form]");
  const formTitle = document.querySelector("[data-product-form-title]");
  const deleteButton = document.querySelector("[data-product-delete]");
  const cancelButton = document.querySelector("[data-product-cancel]");
  const categorySelect = form.elements.category;
  const stockHint = form.querySelector("[data-stock-hint]");
  const imageRows = form.querySelector("[data-image-rows]");
  const imageAdd = form.querySelector("[data-image-add]");
  const imageFile = form.querySelector("[data-image-file]");
  const imageUpload = form.querySelector("[data-image-upload]");
  const specRows = form.querySelector("[data-spec-rows]");
  const specAdd = form.querySelector("[data-spec-add]");
  const variantRows = form.querySelector("[data-variant-rows]");
  const variantAdd = form.querySelector("[data-variant-add]");

  const filters = {
    search: document.querySelector("[data-filter-search]"),
    category: document.querySelector("[data-filter-category]"),
    status: document.querySelector("[data-filter-status]"),
    stock: document.querySelector("[data-filter-stock]"),
    featured: document.querySelector("[data-filter-featured]"),
    sort: document.querySelector("[data-filter-sort]"),
    order: document.querySelector("[data-filter-order]")
  };

  const pageSize = 25;
  let offset = 0;
  let categories = [];
  let selected = new Set();
  let editingId = null;
  let started = false;
  let searchTimer = null;
  // Último pedido de vista previa de cambios masivos (lo reaplica el botón Aplicar).
  let bulkInput = null;
  let bulkPreviewSummary = null;

  /* ---------- Utilidades ---------- */

  const showMessage = (text, kind = "error") => {
    catalogMessage.textContent = text;
    catalogMessage.dataset.kind = kind;
    catalogMessage.hidden = !text;
  };

  const addText = core.addText;
  const formatPrice = core.formatPrice;

  const slugify = (value) => String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  /** Convierte "img/products/x.svg" en "/img/products/x.svg" (mismo origen). */
  const imageUrl = (path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return path.startsWith("/") ? path : `/${path}`;
  };

  /* ---------- Carga de datos ---------- */

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filters.search.value.trim()) params.set("q", filters.search.value.trim());
    if (filters.category.value) params.set("category", filters.category.value);
    if (filters.status.value) params.set("active", filters.status.value);
    if (filters.stock.value) params.set("stock", filters.stock.value);
    if (filters.featured.value) params.set("featured", filters.featured.value);
    params.set("sort", filters.sort.value);
    params.set("order", filters.order.value);
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    return params.toString();
  };

  const loadCategories = async () => {
    const result = await core.request("/api/admin/categories");
    categories = result.categories || [];
    [filters.category, categorySelect, bulkScopeCategory].forEach((select) => {
      const keep = select.value;
      select.replaceChildren();
      if (select === filters.category) {
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "Todas";
        select.appendChild(all);
      }
      if (select === bulkScopeCategory) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Elegir categoría…";
        select.appendChild(placeholder);
      }
      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.label || category.id;
        select.appendChild(option);
      });
      select.value = keep;
    });
  };

  const categoryLabel = (id) => {
    const found = categories.find((category) => category.id === id);
    return found ? (found.label || found.id) : id;
  };

  const renderRow = (product) => {
    const row = document.createElement("tr");

    const checkCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.id = product.id;
    checkbox.checked = selected.has(product.id);
    checkbox.setAttribute("aria-label", `Seleccionar ${product.name}`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(product.id);
      else selected.delete(product.id);
      updateBulkBar();
    });
    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);

    const productCell = document.createElement("td");
    productCell.className = "catalog-table__product";
    const thumb = document.createElement("img");
    thumb.className = "catalog-table__thumb";
    thumb.src = imageUrl(product.images[0]);
    thumb.alt = "";
    thumb.loading = "lazy";
    const identity = document.createElement("div");
    addText(identity, "strong", product.name);
    addText(identity, "span", product.sku);
    productCell.append(thumb, identity);
    row.appendChild(productCell);

    addText(row, "td", categoryLabel(product.category));
    const priceCell = document.createElement("td");
    addText(priceCell, "span", formatPrice(product.price));
    if (product.comparePrice && product.comparePrice > product.price) {
      addText(priceCell, "s", formatPrice(product.comparePrice));
    }
    row.appendChild(priceCell);

    const stockCell = document.createElement("td");
    addText(stockCell, "span", String(product.stock));
    if (product.reserved > 0) addText(stockCell, "small", `${product.reserved} reservadas`);
    row.appendChild(stockCell);

    const statusCell = document.createElement("td");
    const statusTag = document.createElement("span");
    statusTag.className = `tag ${product.active ? "tag--ok" : "tag--muted"}`;
    statusTag.textContent = product.active ? "Publicado" : "Borrador";
    statusCell.appendChild(statusTag);
    if (product.featured) {
      const featuredTag = document.createElement("span");
      featuredTag.className = "tag tag--accent";
      featuredTag.textContent = "Destacado";
      statusCell.appendChild(featuredTag);
    }
    row.appendChild(statusCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "catalog-table__actions";
    const editAction = document.createElement("button");
    editAction.type = "button";
    editAction.className = "link-button";
    editAction.textContent = "Editar";
    editAction.addEventListener("click", () => openForm(product.id));
    actionsCell.appendChild(editAction);

    const duplicateAction = document.createElement("button");
    duplicateAction.type = "button";
    duplicateAction.className = "link-button";
    duplicateAction.textContent = "Duplicar";
    duplicateAction.addEventListener("click", async () => {
      duplicateAction.disabled = true;
      try {
        const result = await core.request(`/api/admin/products/${encodeURIComponent(product.id)}/duplicate`, {
          method: "POST"
        });
        showMessage(`Producto duplicado como "${result.product.name}" (inactivo hasta que lo publiques).`, "ok");
        await loadProducts();
      } catch (error) {
        showMessage(error.message);
        duplicateAction.disabled = false;
      }
    });
    actionsCell.appendChild(duplicateAction);

    const archiveAction = document.createElement("button");
    archiveAction.type = "button";
    archiveAction.className = "link-button";
    archiveAction.textContent = product.active ? "Ocultar" : "Publicar";
    archiveAction.addEventListener("click", async () => {
      archiveAction.disabled = true;
      try {
        await core.request(`/api/admin/products/${encodeURIComponent(product.id)}/archive`, {
          method: "POST",
          body: JSON.stringify({ active: !product.active })
        });
        showMessage(product.active ? "Producto oculto de la tienda." : "Producto publicado en la tienda.", "ok");
        await loadProducts();
      } catch (error) {
        showMessage(error.message);
        archiveAction.disabled = false;
      }
    });
    actionsCell.appendChild(archiveAction);
    row.appendChild(actionsCell);
    return row;
  };

  const updateBulkBar = () => {
    bulkBar.hidden = selected.size === 0;
    bulkCount.textContent = `${selected.size} ${selected.size === 1 ? "seleccionado" : "seleccionados"}`;
    bulkScopeCount.textContent = String(selected.size);
  };

  const loadProducts = async () => {
    catalogMessage.hidden = true;
    const result = await core.request(`/api/admin/products?${buildQuery()}`);
    rowsBody.replaceChildren();
    result.products.forEach((product) => rowsBody.appendChild(renderRow(product)));
    // Saco de la selección los que ya no están visibles.
    const visibleIds = new Set(result.products.map((product) => product.id));
    selected = new Set([...selected].filter((id) => visibleIds.has(id)));
    updateBulkBar();
    emptyState.hidden = result.products.length > 0;
    const from = result.total ? offset + 1 : 0;
    const to = Math.min(offset + result.products.length, result.total);
    pageInfo.textContent = `${from}–${to} de ${result.total}`;
    prevButton.disabled = offset === 0;
    nextButton.disabled = offset + pageSize >= result.total;
    selectAll.checked = false;
  };

  /* ---------- Formulario: imágenes ---------- */

  // Sube un archivo al servidor y devuelve la URL pública (/media/<uuid>.<ext>).
  const uploadImage = async (file) => {
    const buffer = await file.arrayBuffer();
    const result = await core.request("/api/admin/media", {
      method: "POST",
      body: buffer,
      contentType: "application/octet-stream"
    });
    return result.media.url;
  };

  const createImageRow = (value = "") => {
    const row = document.createElement("div");
    row.className = "row-entry";
    row.draggable = false; // se activa solo desde el "grip" para no interferir con inputs

    // Grip de arrastre (reordenar con mouse)
    const grip = document.createElement("span");
    grip.className = "row-entry__grip";
    grip.textContent = "⠿";
    grip.title = "Arrastrá para reordenar";
    grip.setAttribute("aria-hidden", "true");
    grip.addEventListener("mousedown", () => { row.draggable = true; });
    grip.addEventListener("mouseup", () => { row.draggable = false; });
    grip.addEventListener("touchstart", () => { row.draggable = true; }, { passive: true });

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.placeholder = "img/products/olla.svg o /media/…";
    input.setAttribute("aria-label", "Ruta de la imagen");
    const preview = document.createElement("img");
    preview.className = "row-entry__preview";
    preview.alt = "";
    const updatePreview = () => {
      preview.src = imageUrl(input.value.trim());
    };
    input.addEventListener("input", updatePreview);
    if (value) updatePreview();

    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.className = "link-button";
    moveUp.textContent = "↑";
    moveUp.setAttribute("aria-label", "Mover imagen arriba");
    moveUp.addEventListener("click", () => {
      const previous = row.previousElementSibling;
      if (previous) row.parentNode.insertBefore(row, previous);
    });
    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.className = "link-button";
    moveDown.textContent = "↓";
    moveDown.setAttribute("aria-label", "Mover imagen abajo");
    moveDown.addEventListener("click", () => {
      const next = row.nextElementSibling;
      if (next) row.parentNode.insertBefore(next, row);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-button link-button--danger";
    remove.textContent = "Quitar";
    remove.addEventListener("click", async () => {
      const url = input.value.trim();
      // Si es una imagen subida (/media/…), preguntar antes de borrar del servidor.
      if (url.startsWith("/media/")) {
        const confirmed = window.confirm(
          "¿Borrar esta imagen del servidor? Esta acción no se puede deshacer."
        );
        if (!confirmed) return;
        try {
          await core.request(`/api/admin/media/${encodeURIComponent(url.split("/").pop())}`, {
            method: "DELETE"
          });
          showMessage("Imagen borrada del servidor.", "ok");
        } catch (error) {
          // Si está en uso, el servidor responde 409; solo quitamos la fila.
          if (error.status !== 409) {
            showMessage(error.message);
            return;
          }
        }
      }
      row.remove();
    });

    const actions = document.createElement("div");
    actions.className = "row-entry__actions";
    actions.append(moveUp, moveDown, remove);
    row.append(grip, input, preview, actions);
    return row;
  };

  imageAdd.addEventListener("click", () => imageRows.appendChild(createImageRow()));

  // "Subir imágenes": usa el input de archivo persistente del HTML.
  imageUpload.addEventListener("click", () => imageFile.click());

  imageFile.addEventListener("change", async () => {
    const files = Array.from(imageFile.files || []);
    if (!files.length) return;
    imageUpload.disabled = true;
    imageUpload.textContent = "Subiendo…";
    let uploaded = 0;
    for (const file of files) {
      try {
        const url = await uploadImage(file);
        imageRows.appendChild(createImageRow(url));
        uploaded += 1;
      } catch (error) {
        showMessage(error.message);
      }
    }
    imageUpload.disabled = false;
    imageUpload.textContent = "Subir imágenes";
    imageFile.value = "";
    if (uploaded > 0) {
      showMessage(`${uploaded} imagen${uploaded > 1 ? "es" : ""} subida${uploaded > 1 ? "s" : ""}.`, "ok");
    }
  });

  // Arrastre para reordenar (solo activo desde el grip).
  let draggedRow = null;
  imageRows.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".row-entry");
    if (!row) return;
    draggedRow = row;
    row.classList.add("row-entry--dragging");
  });
  imageRows.addEventListener("dragover", (event) => {
    event.preventDefault();
    const row = event.target.closest(".row-entry");
    if (!row || row === draggedRow) return;
    const rect = row.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    if (after) row.parentNode.insertBefore(draggedRow, row.nextSibling);
    else row.parentNode.insertBefore(draggedRow, row);
  });
  imageRows.addEventListener("dragend", () => {
    if (draggedRow) {
      draggedRow.classList.remove("row-entry--dragging");
      draggedRow.draggable = false;
      draggedRow = null;
    }
  });

  /* ---------- Formulario: especificaciones ---------- */

  const createSpecRow = (spec = {}) => {
    const row = document.createElement("div");
    row.className = "row-entry";
    const label = document.createElement("input");
    label.type = "text";
    label.value = spec.label || "";
    label.placeholder = "Concepto (ej.: Material)";
    label.setAttribute("aria-label", "Concepto de la especificación");
    const value = document.createElement("input");
    value.type = "text";
    value.value = spec.value || "";
    value.placeholder = "Valor (ej.: Aluminio forjado)";
    value.setAttribute("aria-label", "Valor de la especificación");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-button link-button--danger";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => row.remove());
    row.append(label, value, remove);
    return row;
  };

  specAdd.addEventListener("click", () => specRows.appendChild(createSpecRow()));

  /* ---------- Formulario: variantes ---------- */

  const createVariantRow = (variant = {}) => {
    const row = document.createElement("div");
    row.className = "row-entry";
    const label = document.createElement("input");
    label.type = "text";
    label.value = variant.label || "";
    label.placeholder = "Nombre (ej.: Color)";
    label.setAttribute("aria-label", "Nombre de la variante");
    const options = document.createElement("input");
    options.type = "text";
    options.value = Array.isArray(variant.options) ? variant.options.join(", ") : "";
    options.placeholder = "Opciones separadas por coma (ej.: Negro, Rojo)";
    options.setAttribute("aria-label", "Opciones de la variante");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-button link-button--danger";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => row.remove());
    row.append(label, options, remove);
    return row;
  };

  variantAdd.addEventListener("click", () => variantRows.appendChild(createVariantRow()));

  /* ---------- Formulario: abrir / limpiar ---------- */

  const resetForm = () => {
    form.reset();
    form.elements.active.checked = true;
    imageRows.replaceChildren(createImageRow());
    specRows.replaceChildren();
    variantRows.replaceChildren();
    stockHint.textContent = "Es el stock físico disponible para vender.";
  };

  const openForm = async (id = null) => {
    editingId = id;
    resetForm();
    if (id) {
      const result = await core.request(`/api/admin/products/${encodeURIComponent(id)}`);
      const product = result.product;
      formTitle.textContent = `Editar: ${product.name}`;
      form.elements.name.value = product.name;
      form.elements.sku.value = product.sku;
      form.elements.category.value = product.category;
      form.elements.subcategory.value = product.subcategory || "";
      form.elements.slug.value = product.slug;
      form.elements.price.value = product.price;
      form.elements.comparePrice.value = product.comparePrice == null ? "" : product.comparePrice;
      form.elements.stock.value = product.stock;
      form.elements.shortDescription.value = product.shortDescription || "";
      form.elements.description.value = product.description || "";
      form.elements.tags.value = (product.tags || []).join(", ");
      form.elements.featured.checked = Boolean(product.featured);
      form.elements.active.checked = Boolean(product.active);
      imageRows.replaceChildren();
      (product.images || []).forEach((image) => imageRows.appendChild(createImageRow(image)));
      if (!imageRows.children.length) imageRows.appendChild(createImageRow());
      specRows.replaceChildren();
      (product.specs || []).forEach((spec) => specRows.appendChild(createSpecRow(spec)));
      variantRows.replaceChildren();
      (product.variants || []).forEach((variant) => variantRows.appendChild(createVariantRow(variant)));
      if (product.reserved > 0) {
        stockHint.textContent = `Hay ${product.reserved} ${product.reserved === 1 ? "unidad reservada" : "unidades reservadas"} por pedidos en curso: no podés bajar el stock por debajo de ese número.`;
      }
      deleteButton.hidden = false;
    } else {
      formTitle.textContent = "Nuevo producto";
      deleteButton.hidden = true;
    }
    catalogPanel.querySelector("[data-catalog-filters]").hidden = true;
    document.querySelector(".table-wrap").hidden = true;
    document.querySelector("[data-catalog-empty]").hidden = true;
    document.querySelector(".pagination").hidden = true;
    bulkBar.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  };

  const closeForm = async (okMessage = "") => {
    editingId = null;
    form.hidden = true;
    catalogPanel.querySelector("[data-catalog-filters]").hidden = false;
    document.querySelector(".table-wrap").hidden = false;
    document.querySelector(".pagination").hidden = false;
    updateBulkBar();
    try {
      await loadProducts();
      // El mensaje se muestra después de recargar: loadProducts() limpia el
      // área de mensajes al principio y borraría la confirmación.
      if (okMessage) showMessage(okMessage, "ok");
    } catch (error) {
      showMessage(error.message);
    }
  };

  /* ---------- Formulario: recolectar datos ---------- */

  const collectProduct = () => {
    const images = [...imageRows.querySelectorAll(".row-entry input[type='text']")]
      .map((input) => input.value.trim())
      .filter(Boolean);
    const specs = [...specRows.children].map((row) => {
      const inputs = row.querySelectorAll("input");
      return { label: inputs[0].value.trim(), value: inputs[1].value.trim() };
    }).filter((spec) => spec.label && spec.value);
    const variants = [...variantRows.children].map((row, index) => {
      const inputs = row.querySelectorAll("input");
      const options = inputs[1].value.split(",").map((option) => option.trim()).filter(Boolean);
      return { id: `v${index + 1}`, label: inputs[0].value.trim(), options };
    }).filter((variant) => variant.label && variant.options.length);
    return {
      name: form.elements.name.value.trim(),
      sku: form.elements.sku.value.trim(),
      slug: form.elements.slug.value.trim() || slugify(form.elements.name.value),
      category: form.elements.category.value,
      subcategory: form.elements.subcategory.value.trim(),
      price: Number(form.elements.price.value),
      comparePrice: form.elements.comparePrice.value === "" ? null : Number(form.elements.comparePrice.value),
      stock: Number(form.elements.stock.value),
      images,
      shortDescription: form.elements.shortDescription.value.trim(),
      description: form.elements.description.value.trim(),
      specs,
      variants,
      tags: form.elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
      featured: form.elements.featured.checked,
      active: form.elements.active.checked
    };
  };

  /* ---------- Formulario: guardar / eliminar ---------- */

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const payload = collectProduct();
      if (editingId) {
        await core.request(`/api/admin/products/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        await closeForm("Producto guardado.");
      } else {
        await core.request("/api/admin/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        await closeForm("Producto creado.");
      }
    } catch (error) {
      showMessage(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (!editingId) return;
    const confirmed = window.confirm(
      "¿Eliminar este producto de forma definitiva? Solo funciona si no tiene ventas ni reservas registradas."
    );
    if (!confirmed) return;
    deleteButton.disabled = true;
    try {
      await core.request(`/api/admin/products/${encodeURIComponent(editingId)}`, { method: "DELETE" });
      await closeForm("Producto eliminado.");
    } catch (error) {
      showMessage(error.message);
    } finally {
      deleteButton.disabled = false;
    }
  });

  cancelButton.addEventListener("click", () => {
    closeForm();
  });

  /* ---------- Listado: filtros, paginación, selección ---------- */

  newButton.addEventListener("click", () => {
    openForm(null).catch((error) => showMessage(error.message));
  });

  prevButton.addEventListener("click", () => {
    offset = Math.max(0, offset - pageSize);
    loadProducts().catch((error) => showMessage(error.message));
  });

  nextButton.addEventListener("click", () => {
    offset += pageSize;
    loadProducts().catch((error) => showMessage(error.message));
  });

  selectAll.addEventListener("change", () => {
    rowsBody.querySelectorAll("input[type='checkbox']").forEach((box) => {
      box.checked = selectAll.checked;
      if (!box.dataset.id) return;
      if (selectAll.checked) selected.add(box.dataset.id);
      else selected.delete(box.dataset.id);
    });
    updateBulkBar();
  });

  const bulkSetActive = async (active) => {
    if (!selected.size) return;
    const confirmed = window.confirm(
      active
        ? `¿Publicar ${selected.size} producto(s) en la tienda?`
        : `¿Ocultar ${selected.size} producto(s) de la tienda?`
    );
    if (!confirmed) return;
    bulkPublish.disabled = true;
    bulkUnpublish.disabled = true;
    try {
      for (const id of selected) {
        await core.request(`/api/admin/products/${encodeURIComponent(id)}/archive`, {
          method: "POST",
          body: JSON.stringify({ active })
        });
      }
      showMessage(
        active
          ? `${selected.size} producto(s) publicados.`
          : `${selected.size} producto(s) ocultos.`,
        "ok"
      );
      selected.clear();
      await loadProducts();
    } catch (error) {
      showMessage(error.message);
    } finally {
      bulkPublish.disabled = false;
      bulkUnpublish.disabled = false;
    }
  };

  bulkPublish.addEventListener("click", () => bulkSetActive(true));
  bulkUnpublish.addEventListener("click", () => bulkSetActive(false));

  /* ---------- Operaciones masivas (Etapa 3) ---------- */

  const showBulkMessage = (text, kind = "error") => {
    bulkMessage.textContent = text;
    bulkMessage.dataset.kind = kind;
    bulkMessage.hidden = !text;
  };

  const currentBulkScope = () => {
    const checked = [...bulkScopeRadios].find((radio) => radio.checked);
    return checked ? checked.value : "selection";
  };

  // Cada cambio en los datos invalida la vista previa: el botón "Aplicar"
  // solo aparece con una vista previa fresca del mismo pedido.
  const invalidateBulkPreview = () => {
    bulkInput = null;
    bulkPreviewSummary = null;
    bulkApply.hidden = true;
    bulkApply.disabled = false;
    bulkApply.textContent = "Aplicar cambios…";
    bulkResult.hidden = true;
    bulkResultRows.replaceChildren();
  };

  const formatBulkValue = (field, value) => {
    if (value === null || value === undefined) return "—";
    if (field === "price") return formatPrice(value);
    if (field === "stock") return `${Number(value).toLocaleString("es-AR")} unidades`;
    if (field === "active") return value ? "Publicado" : "Oculto";
    return value ? "Destacado" : "Sin destacar";
  };

  /** Arma el pedido al servidor; devuelve null y muestra un aviso si falta algo. */
  const buildBulkInput = () => {
    if (currentBulkScope() === "category") {
      if (!bulkScopeCategory.value) {
        showBulkMessage("Elegí la categoría a modificar.");
        return null;
      }
    } else if (!selected.size) {
      showBulkMessage("Seleccioná al menos un producto en la lista.");
      return null;
    }
    const kind = bulkKind.value;
    if (!kind) {
      showBulkMessage("Elegí qué cambio querés hacer.");
      return null;
    }
    let operation = null;
    if (kind === "price") {
      if (bulkPriceValue.value === "") {
        showBulkMessage("Completá el valor del cambio de precio.");
        return null;
      }
      operation = {
        kind: "price",
        mode: bulkPriceMode.value,
        direction: bulkPriceDirection.value,
        value: Number(bulkPriceValue.value),
        rounding: bulkPriceRounding.value
      };
    } else if (kind === "active" || kind === "featured") {
      operation = { kind, value: bulkBoolValue.value === "true" };
    } else {
      if (bulkStockValue.value === "") {
        showBulkMessage("Completá las unidades del ajuste de stock.");
        return null;
      }
      operation = {
        kind: "stock",
        mode: bulkStockMode.value,
        value: Number(bulkStockValue.value)
      };
    }
    const scope = currentBulkScope() === "category"
      ? { type: "category", category: bulkScopeCategory.value }
      : { type: "ids", ids: [...selected] };
    return { scope, operation };
  };

  const renderBulkResult = (result, applied = false) => {
    bulkResultRows.replaceChildren();
    result.rows.forEach((item) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const sku = document.createElement("span");
      sku.className = "bulk-ops__sku";
      sku.textContent = item.sku;
      nameCell.append(name, sku);
      row.appendChild(nameCell);

      const currentCell = document.createElement("td");
      currentCell.textContent = formatBulkValue(result.field, item.current);
      row.appendChild(currentCell);

      const nextCell = document.createElement("td");
      nextCell.textContent = formatBulkValue(result.field, item.next);
      if (item.note) {
        const note = document.createElement("span");
        note.className = "bulk-ops__note";
        note.textContent = item.note;
        nextCell.appendChild(note);
      }
      row.appendChild(nextCell);

      const statusCell = document.createElement("td");
      statusCell.className = `bulk-ops__status bulk-ops__status--${item.status}`;
      statusCell.textContent = item.status === "change"
        ? (applied ? "Modificado" : "Se modificará")
        : item.status === "noop"
          ? "Sin cambios"
          : "No se puede";
      if (item.reason) {
        const reason = document.createElement("span");
        reason.className = "bulk-ops__reason";
        reason.textContent = item.reason;
        statusCell.appendChild(reason);
      }
      row.appendChild(statusCell);

      bulkResultRows.appendChild(row);
    });

    const summary = result.summary;
    const parts = [
      `${summary.total} producto(s) en alcance`,
      `${summary.changes} a modificar`
    ];
    if (summary.noops) parts.push(`${summary.noops} sin cambios`);
    if (summary.blocked) parts.push(`${summary.blocked} no se pueden modificar`);
    if (typeof summary.applied === "number") parts.push(`${summary.applied} aplicado(s)`);
    bulkSummary.textContent = `${applied ? "Aplicado · " : ""}${result.description} · ${parts.join(" · ")}`;
  };

  bulkOpen.addEventListener("click", () => {
    const willOpen = bulkOps.hidden;
    bulkOps.hidden = !willOpen;
    bulkOpen.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) {
      bulkScopeCount.textContent = String(selected.size);
      const isCategory = currentBulkScope() === "category";
      bulkScopeCategory.hidden = !isCategory;
      bulkScopeCategory.disabled = isCategory ? false : true;
    }
  });

  bulkScopeRadios.forEach((radio) => radio.addEventListener("change", () => {
    const isCategory = currentBulkScope() === "category";
    bulkScopeCategory.hidden = !isCategory;
    bulkScopeCategory.disabled = !isCategory;
    invalidateBulkPreview();
  }));

  bulkKind.addEventListener("change", () => {
    const kind = bulkKind.value;
    bulkPriceFields.hidden = kind !== "price";
    bulkBoolFields.hidden = kind !== "active" && kind !== "featured";
    bulkStockFields.hidden = kind !== "stock";
    if (kind === "active") bulkBoolLabel.textContent = "Publicar en la tienda";
    if (kind === "featured") bulkBoolLabel.textContent = "Destacar en la tienda";
    invalidateBulkPreview();
  });

  bulkPriceMode.addEventListener("change", () => {
    const isPercent = bulkPriceMode.value === "percent";
    bulkPriceValueLabel.textContent = isPercent ? "Valor (%)" : "Valor ($)";
    bulkPriceValue.min = isPercent ? "0.01" : "1";
    bulkPriceValue.max = isPercent ? "1000" : "100000000";
    bulkPriceValue.step = isPercent ? "0.5" : "1";
    bulkPriceValue.placeholder = isPercent ? "Ej.: 10" : "Ej.: 500";
    invalidateBulkPreview();
  });

  bulkStockMode.addEventListener("change", () => {
    bulkStockValueLabel.textContent = {
      increase: "Unidades a sumar",
      decrease: "Unidades a restar",
      set: "Stock final (góndola)"
    }[bulkStockMode.value];
    invalidateBulkPreview();
  });

  // Cualquier toque en los controles de datos deja la vista previa vieja.
  [
    bulkScopeCategory,
    bulkKind,
    bulkPriceDirection,
    bulkPriceValue,
    bulkPriceRounding,
    bulkBoolValue,
    bulkStockValue
  ].forEach((control) => {
    control.addEventListener("input", invalidateBulkPreview);
    control.addEventListener("change", invalidateBulkPreview);
  });

  bulkPreview.addEventListener("click", async () => {
    const input = buildBulkInput();
    if (!input) return;
    invalidateBulkPreview();
    bulkPreview.disabled = true;
    try {
      const result = await core.request("/api/admin/catalog/bulk/preview", {
        method: "POST",
        body: JSON.stringify(input)
      });
      bulkInput = input;
      bulkPreviewSummary = result.summary;
      renderBulkResult(result);
      bulkResult.hidden = false;
      if (result.summary.changes > 0) {
        bulkApply.hidden = false;
        bulkApply.disabled = false;
        bulkApply.textContent = `Aplicar ${result.summary.changes} cambio(s)…`;
        showBulkMessage("Vista previa lista. Nada se aplicó todavía: revisá y confirmá.", "ok");
      } else {
        bulkApply.hidden = true;
        showBulkMessage("Ningún producto requiere cambios con esa operación.", "ok");
      }
    } catch (error) {
      showBulkMessage(error.message);
    } finally {
      bulkPreview.disabled = false;
    }
  });

  bulkApply.addEventListener("click", async () => {
    if (!bulkInput || !bulkPreviewSummary) return;
    const confirmed = window.confirm(
      `¿Aplicar ${bulkPreviewSummary.changes} cambio(s) a ${bulkPreviewSummary.total} producto(s)?\n` +
      "Se modificarán solo los campos indicados en la vista previa."
    );
    if (!confirmed) return;
    bulkApply.disabled = true;
    try {
      const result = await core.request("/api/admin/catalog/bulk/apply", {
        method: "POST",
        body: JSON.stringify(bulkInput)
      });
      renderBulkResult(result, true);
      bulkResult.hidden = false;
      bulkApply.hidden = true;
      showBulkMessage(`Listo: ${result.summary.applied} producto(s) modificado(s).`, "ok");
      bulkInput = null;
      bulkPreviewSummary = null;
      await loadProducts();
    } catch (error) {
      showBulkMessage(error.message);
      bulkApply.disabled = false;
    }
  });

  // Estado inicial: el select de categoría solo se muestra con ese alcance.
  bulkScopeCategory.hidden = true;
  bulkScopeCategory.disabled = true;

  Object.values(filters).forEach((control) => {
    if (control === filters.search) {
      control.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          offset = 0;
          loadProducts().catch((error) => showMessage(error.message));
        }, 350);
      });
      return;
    }
    control.addEventListener("change", () => {
      offset = 0;
      loadProducts().catch((error) => showMessage(error.message));
    });
  });

  /* ---------- Arranque ---------- */

  const start = async () => {
    if (started) return;
    started = true;
    try {
      await loadCategories();
      await loadProducts();
    } catch (error) {
      showMessage(error.message);
    }
  };

  window.addEventListener("admin:ready", () => {
    if (core.currentSection === "catalog") start();
  });

  window.addEventListener("admin:section", (event) => {
    if (event.detail && event.detail.section === "catalog") start();
  });

  window.addEventListener("admin:catalog-changed", () => {
    if (started && form.hidden) {
      loadProducts().catch((error) => showMessage(error.message));
    }
  });
})();
