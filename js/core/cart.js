/* ==========================================================================
   cart.js — Estado persistente del carrito, sin manipular la interfaz
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "cima-cart-v1";
  const products = window.PRODUCTS || [];
  let items = [];
  let notices = [];
  let storageError = "";
  let storageReadFailed = false;

  const findProduct = (productId) =>
    products.find((product) => product.id === productId && product.active);

  const normalizeVariants = (product, variants) => {
    const selected = Array.isArray(variants) ? variants : [];
    return (product.variants || []).reduce((result, variant) => {
      const choice = selected.find((item) => item && item.id === variant.id);
      const value = choice && variant.options.includes(choice.value)
        ? choice.value
        : variant.options[0];
      if (value) result.push({ id: variant.id, label: variant.label, value });
      return result;
    }, []);
  };

  const makeLineId = (productId, variants) =>
    productId + ":" + JSON.stringify(variants.map((variant) => [variant.id, variant.value]));

  const getTotals = () => ({
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    count: items.reduce((sum, item) => sum + item.qty, 0)
  });

  const notify = () => {
    window.dispatchEvent(new CustomEvent("cart:change", {
      detail: {
        items: getItems(),
        totals: getTotals(),
        notices: notices.slice(),
        storageError
      }
    }));
  };

  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      storageError = "";
    } catch (error) {
      storageError = "No pudimos guardar el carrito en este navegador. Tus cambios pueden perderse al cerrar la página.";
      console.error("No se pudo guardar el carrito en localStorage.", error);
    }
  };

  const persistAndNotify = () => {
    save();
    notify();
  };

  const reconcile = (storedItems) => {
    const validItems = [];
    const seen = new Set();

    storedItems.forEach((stored) => {
      if (!stored || typeof stored.productId !== "string") {
        notices.push("Se quitaron datos inválidos guardados en el carrito.");
        return;
      }

      const product = findProduct(stored.productId);
      if (!product || product.stock <= 0) {
        notices.push((stored.name || "Un producto") + " ya no está disponible y se quitó del carrito.");
        return;
      }

      const variants = normalizeVariants(product, stored.variants);
      const id = makeLineId(product.id, variants);
      if (seen.has(id)) return;
      seen.add(id);

      if (Number(stored.unitPrice) !== product.price) {
        notices.push("El precio de " + product.name + " se actualizó a " + window.Utils.formatPrice(product.price) + ".");
      }

      const qty = Math.min(product.stock, Math.max(1, Math.floor(Number(stored.qty) || 1)));
      if (qty !== Number(stored.qty)) {
        notices.push("La cantidad de " + product.name + " se ajustó a " + qty + " por disponibilidad.");
      }

      validItems.push({
        id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images && product.images[0] ? product.images[0] : "",
        unitPrice: product.price,
        stock: product.stock,
        qty,
        variants
      });
    });

    return validItems;
  };

  const readStorage = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        notices.push("Se reinició un carrito guardado con un formato inválido.");
        return [];
      }
      return parsed;
    } catch (error) {
      storageReadFailed = true;
      storageError = "No pudimos leer el carrito guardado en este navegador.";
      console.error("No se pudo leer el carrito desde localStorage.", error);
      return [];
    }
  };

  const getItems = () => items.map((item) => ({
    ...item,
    variants: item.variants.map((variant) => ({ ...variant }))
  }));

  const add = (productId, quantity, selectedVariants) => {
    const product = findProduct(productId);
    if (!product) return { ok: false, message: "Este producto ya no está disponible." };
    if (product.stock <= 0) return { ok: false, message: "Este producto está agotado." };

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return { ok: false, message: "Elegí una cantidad válida." };
    }

    const variants = normalizeVariants(product, selectedVariants);
    const id = makeLineId(product.id, variants);
    const existing = items.find((item) => item.id === id);
    const nextQty = (existing ? existing.qty : 0) + qty;
    if (nextQty > product.stock) {
      return {
        ok: false,
        message: "Solo quedan " + product.stock + " unidades disponibles."
      };
    }

    if (existing) {
      existing.qty = nextQty;
    } else {
      items.push({
        id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images && product.images[0] ? product.images[0] : "",
        unitPrice: product.price,
        stock: product.stock,
        qty,
        variants
      });
    }

    persistAndNotify();
    return { ok: true, message: "Se agregó " + product.name + " al carrito." };
  };

  const update = (id, quantity) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return { ok: false, message: "No encontramos ese producto en el carrito." };

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return { ok: false, message: "La cantidad debe ser al menos 1." };
    }
    if (qty > item.stock) {
      return { ok: false, message: "Solo quedan " + item.stock + " unidades de " + item.name + "." };
    }

    item.qty = qty;
    persistAndNotify();
    return { ok: true, message: "Cantidad actualizada." };
  };

  const remove = (id) => {
    const nextItems = items.filter((item) => item.id !== id);
    if (nextItems.length === items.length) return false;
    items = nextItems;
    persistAndNotify();
    return true;
  };

  const clear = () => {
    items = [];
    persistAndNotify();
  };

  items = reconcile(readStorage());
  if (!storageReadFailed) save();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    notices = [];
    items = reconcile(readStorage());
    notify();
  });

  window.Cart = {
    add,
    update,
    remove,
    clear,
    getItems,
    getCount: () => getTotals().count,
    getSubtotal: () => getTotals().subtotal,
    getNotices: () => notices.slice(),
    getStorageError: () => storageError
  };

  notify();
})();
