/* ==========================================================================
   product-rules.js — Reglas puras de validación de productos
   --------------------------------------------------------------------------
   Un solo lugar para las reglas de formato de un producto, compartido por:
   • db.js (importación CSV existente) — comportamiento idéntico al actual.
   • catalog-manage.js (edición individual desde el panel).
   No toca la base de datos: solo valida y lanza errores con .status HTTP.
   ========================================================================== */

/** Ruta de imagen segura: sin \ , sin .., sin javascript: ni data: */
const isSafeImagePath = (image) =>
  typeof image === "string" &&
  image.length > 0 &&
  image.length <= 500 &&
  !image.includes("\\") &&
  !/^javascript:/i.test(image) &&
  !/^data:/i.test(image) &&
  !image.split("/").includes("..");

/** true si las variantes NO tienen el formato esperado [{ id, label, options }] */
const hasInvalidVariants = (variants) =>
  !Array.isArray(variants) ||
  variants.some((variant) =>
    !variant ||
    typeof variant.id !== "string" ||
    typeof variant.label !== "string" ||
    !Array.isArray(variant.options) ||
    variant.options.some((option) => typeof option !== "string")
  );

/** true si las especificaciones NO tienen el formato esperado [{ label, value }] */
const hasInvalidSpecs = (specs) =>
  !Array.isArray(specs) ||
  specs.some((spec) =>
    !spec || typeof spec.label !== "string" || typeof spec.value !== "string"
  );

/**
 * Valida variantes y especificaciones con el MISMO mensaje y la MISMA
 * regla que usaba db.js, para no romper la importación CSV existente.
 */
const validateProductLists = (product) => {
  if (hasInvalidVariants(product.variants)) {
    throw Object.assign(
      new Error(`Las variantes de "${product.name}" no tienen un formato válido.`),
      { status: 400 }
    );
  }
  if (hasInvalidSpecs(product.specs)) {
    throw Object.assign(
      new Error(`Las especificaciones de "${product.name}" no tienen un formato válido.`),
      { status: 400 }
    );
  }
};

/**
 * Valida fecha, descripciones, imágenes y etiquetas con el MISMO mensaje
 * y la MISMA regla combinada que usaba db.js para la importación CSV.
 */
const validateProductTexts = (product) => {
  if (typeof product.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(product.createdAt) ||
      typeof product.description !== "string" || product.description.length > 20000 ||
      typeof product.shortDescription !== "string" || product.shortDescription.length > 500 ||
      !Array.isArray(product.images) || product.images.length < 1 || product.images.length > 20 ||
      product.images.some((image) => !isSafeImagePath(image)) ||
      !Array.isArray(product.tags) || product.tags.some((tag) => typeof tag !== "string" || tag.length > 40)) {
    throw Object.assign(
      new Error(`La fecha, descripción, imágenes o etiquetas de "${product.name}" exceden el formato permitido.`),
      { status: 400 }
    );
  }
};

module.exports = {
  isSafeImagePath,
  hasInvalidVariants,
  hasInvalidSpecs,
  validateProductLists,
  validateProductTexts
};
