const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

const loadBrowserData = (relativePath, globalName) => {
  const filePath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const context = vm.createContext({ window: {} }, {
    codeGeneration: { strings: false, wasm: false }
  });
  const script = new vm.Script(source, { filename: filePath });
  script.runInContext(context, { timeout: 1000 });
  const data = context.window[globalName];

  if (!Array.isArray(data)) {
    throw new Error(`No se pudo cargar ${globalName} desde ${relativePath}.`);
  }

  return data;
};

const loadCatalogSource = () => ({
  categories: loadBrowserData("js/data/categories.js", "CATEGORIES"),
  products: loadBrowserData("js/data/products.js", "PRODUCTS")
});

const loadStoreConfig = () => {
  const filePath = path.join(projectRoot, "js/config.js");
  const source = fs.readFileSync(filePath, "utf8");
  const context = vm.createContext({ window: {} }, {
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, { filename: filePath }).runInContext(context, { timeout: 1000 });
  const config = context.window.STORE_CONFIG;
  if (!config || typeof config !== "object") {
    throw new Error("No se pudo cargar STORE_CONFIG desde js/config.js.");
  }
  return config;
};

module.exports = { loadCatalogSource, loadStoreConfig };
