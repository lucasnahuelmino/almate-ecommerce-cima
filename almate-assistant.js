/* ==========================================================================
   almate-assistant.js — Motor universal del Asistente ALMATE
   --------------------------------------------------------------------------
   Asistente virtual sin IA ni servicios externos: menús guiados, preguntas
   frecuentes, reconocimiento de palabras clave y derivación a WhatsApp.

   Estándar común para todas las plantillas ALMATE:
   - No contiene datos del negocio: todo vive en almate-assistant.config.js.
   - No usa dependencias ni frameworks.
   - Se puede cargar en cualquier página con:
       <link rel="stylesheet" href="almate-assistant.css">
       <script defer src="almate-assistant.config.js"></script>
       <script defer src="almate-assistant.js"></script>

   API pública (window.AlmateAssistant):
     version, config, open(), close(), toggle(), reset(), send(texto),
     resolve(texto), registerModule(nombre, funcion), setAIHandler(funcion),
     on(evento, funcion), off(evento, funcion)

   Módulos avanzados (apagados por defecto en la configuración):
     ai, catalog, priceLookup, stockLookup. El motor ya tiene los ganchos para
     que ALMATE IA Comercial se enchufe sin cambiar el diseño ni las FAQ.

   Accesibilidad: diálogo no modal, foco visible, Escape para cerrar,
   región aria-live para la conversación y áreas táctiles de 44 px.
   ========================================================================== */

(function (global) {
  "use strict";

  const VERSION = "1.0.0";
  const ROOT_ID = "almate-assistant-root";

  // Evita duplicados si el script se incluye dos veces o si ya hay una instancia.
  if (global.AlmateAssistant && global.AlmateAssistant.version) return;
  if (typeof document !== "undefined" && document.getElementById(ROOT_ID)) return;

  const config = global.ALMATE_ASSISTANT_CONFIG;
  if (!config || !config.business) {
    if (global.console && global.console.warn) {
      global.console.warn("[ALMATE Assistant] No se encontró almate-assistant.config.js.");
    }
    return;
  }

  const uiText = config.ui || {};
  const modules = Object.assign({
    guidedMenus: true,
    keywordMatching: true,
    faq: true,
    whatsapp: true,
    ai: false,
    catalog: false,
    priceLookup: false,
    stockLookup: false
  }, config.modules || {});

  const toList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
  const hasWhatsapp = Boolean(config.whatsapp && config.whatsapp.number);

  /* ========================================================================
     1. Índices de contenido (menús y FAQ)
     ======================================================================== */

  const nodeIndex = new Map();
  const faqIndex = new Map();
  const rootMenu = toList(config.guidedMenus);

  const indexMenu = (items, parentId) => {
    items.forEach((item) => {
      if (!item || !item.id || nodeIndex.has(item.id)) return;
      nodeIndex.set(item.id, Object.assign({}, item, { parentId: parentId || null }));
      if (Array.isArray(item.children)) indexMenu(toList(item.children), item.id);
    });
  };
  indexMenu(rootMenu, null);

  toList(config.faq).forEach((entry) => {
    if (!entry || !entry.id || !entry.question) return;
    if (!faqIndex.has(entry.id)) faqIndex.set(entry.id, entry);
  });

  /* ========================================================================
     2. Reconocimiento de texto (sin acentos, sin mayúsculas)
     ======================================================================== */

  function normalizeWord(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const matching = config.keywordMatching || {};
  const aliasMap = new Map();

  const addAlias = (alias, canonical) => {
    const key = normalizeWord(alias);
    if (!key) return;
    if (!aliasMap.has(key)) aliasMap.set(key, new Set());
    aliasMap.get(key).add(canonical);
  };

  Object.keys(matching.synonyms || {}).forEach((canonical) => {
    const key = normalizeWord(canonical);
    if (!key) return;
    addAlias(key, key);
    toList(matching.synonyms[canonical]).forEach((alias) => addAlias(alias, key));
  });

  // Convierte el texto del cliente en un conjunto de términos canónicos.
  // "¿Cuánto sale el envío?" → { precio, envio, ... }
  const expandTokens = (text) => {
    const words = normalizeWord(text).split(" ").filter(Boolean);
    const tokens = new Set(words);
    words.forEach((word) => {
      const direct = aliasMap.get(word);
      if (direct) direct.forEach((canonical) => tokens.add(canonical));
      // Plural simple: "envios" → "envio" cuando el singular está mapeado.
      if (word.length > 4 && word.charAt(word.length - 1) === "s") {
        const singular = aliasMap.get(word.slice(0, -1));
        if (singular) singular.forEach((canonical) => tokens.add(canonical));
      }
    });
    return tokens;
  };

  const scoreKeywords = (normalizedText, tokens, keywords) => {
    const terms = toList(keywords).map(normalizeWord).filter(Boolean);
    let raw = 0;
    let matched = 0;
    terms.forEach((term) => {
      if (term.indexOf(" ") !== -1) {
        if (normalizedText.indexOf(term) !== -1) {
          raw += 4;
          matched += 1;
        }
        return;
      }
      if (tokens.has(term)) {
        raw += 2;
        matched += 1;
        return;
      }
      // Coincidencia parcial solo para palabras largas ("devolucion").
      if (term.length >= 5) {
        const partial = Array.from(tokens).some((token) =>
          token.length >= 5 &&
          (token.indexOf(term) === 0 || term.indexOf(token) === 0)
        );
        if (partial) {
          raw += 1;
          matched += 1;
        }
      }
    });
    // Especificidad: una respuesta que explica exactamente lo preguntado
    // (usa todas sus palabras clave) gana sobre una que coincide de casualidad.
    const unmatched = Math.max(0, terms.length - matched);
    return { raw: raw, specific: matched, total: terms.length, score: raw * 10 - unmatched * 2 };
  };

  /**
   * Devuelve la FAQ que mejor responde al texto, o null si no hay confianza
   * suficiente. Es una función pura: no toca el DOM y se puede probar aparte.
   */
  const resolve = (text) => {
    if (!modules.faq || !modules.keywordMatching) return null;
    const normalized = normalizeWord(text);
    if (!normalized) return null;
    const tokens = expandTokens(text);
    const threshold = Number(matching.threshold || 2);
    let best = null;
    let bestScore = -Infinity;
    faqIndex.forEach((entry) => {
      const result = scoreKeywords(normalized, tokens, entry.keywords);
      if (result.raw < threshold) return;
      if (result.score > bestScore) {
        bestScore = result.score;
        best = Object.assign({}, entry, { type: "faq", score: result.score, matched: result.specific });
      }
    });
    return best;
  };

  const fallbackMessages = () => {
    const list = toList(matching.fallback).map(String).filter(Boolean);
    return list.length
      ? list
      : ["No estoy seguro de haber entendido. Probá elegir una opción del menú."];
  };
  let fallbackIndex = 0;

  /* ========================================================================
     3. Extensiones futuras (IA Comercial, catálogo, precios, stock)
     ======================================================================== */

  const externalHandlers = {
    ai: null,
    catalog: null,
    priceLookup: null,
    stockLookup: null
  };

  const registerModule = (name, handler) => {
    if (!Object.prototype.hasOwnProperty.call(externalHandlers, name)) return false;
    externalHandlers[name] = typeof handler === "function" ? handler : null;
    return true;
  };

  const setAIHandler = (handler) => registerModule("ai", handler);

  // Si un módulo externo está activo y devuelve una respuesta, se usa esa.
  // Si falla o no responde, el asistente sigue funcionando con las FAQ locales.
  const runExternal = async (text) => {
    if (!modules.ai || typeof externalHandlers.ai !== "function") return null;
    try {
      const result = await externalHandlers.ai({
        text: text,
        config: config,
        business: config.business
      });
      if (result && (result.text || result.answer)) {
        return {
          type: "ai",
          text: result.text || result.answer,
          links: toList(result.links)
        };
      }
    } catch (error) {
      if (global.console && global.console.warn) {
        global.console.warn("[ALMATE Assistant] El módulo de IA falló; se usa la respuesta local.", error);
      }
    }
    return null;
  };

  /* ========================================================================
     4. Eventos
     ======================================================================== */

  const listeners = new Map();

  const on = (name, handler) => {
    if (typeof handler !== "function") return () => {};
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(handler);
    return () => off(name, handler);
  };

  const off = (name, handler) => {
    const set = listeners.get(name);
    if (set) set.delete(handler);
  };

  const emit = (name, detail) => {
    const set = listeners.get(name);
    if (set) {
      Array.from(set).forEach((handler) => {
        try {
          handler(detail || {});
        } catch (error) {
          if (global.console && global.console.error) {
            global.console.error("[ALMATE Assistant] Error en un listener.", error);
          }
        }
      });
    }
    if (typeof document !== "undefined" && typeof global.CustomEvent === "function") {
      document.dispatchEvent(new global.CustomEvent("almate:" + name, { detail: detail || {} }));
    }
  };

  /* ========================================================================
     5. Interfaz
     ======================================================================== */

  let root = null;
  let panel = null;
  let log = null;
  let input = null;
  let launcher = null;
  let backButton = null;
  let isOpen = false;
  let isAtRoot = true;
  let lastBlock = null;
  let typingNode = null;
  let resizeTimer = null;
  let barObserver = null;

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  };

  const createIcon = (pathData, className) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (className) svg.setAttribute("class", className);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  };

  const whatsappUrl = (message) => {
    const number = String((config.whatsapp && config.whatsapp.number) || "").replace(/\D/g, "");
    const text = message || (config.whatsapp && config.whatsapp.defaultMessage) || "";
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  };

  const whatsappLink = (message, className) => {
    const link = create("a", className || "almate-wa", uiText.whatsappLabel || "Escribir por WhatsApp");
    link.href = whatsappUrl(message);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  };

  const scrollToEnd = () => {
    if (!log) return;
    const run = () => { log.scrollTop = log.scrollHeight; };
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  const setAtRoot = (value) => {
    isAtRoot = Boolean(value);
    if (backButton) backButton.hidden = isAtRoot;
  };

  const paragraphsOf = (text) => (Array.isArray(text) ? text : [text]);

  const appendBubble = (kind, text, options) => {
    if (!log) return null;
    const wrap = create("div", "almate-message almate-message--" + kind);
    const bubble = create("div", "almate-bubble");
    paragraphsOf(text).forEach((paragraph) => {
      if (paragraph == null || paragraph === "") return;
      bubble.appendChild(create("p", "almate-paragraph", paragraph));
    });
    toList(options && options.links).forEach((link) => {
      if (!link || !link.label || !link.href) return;
      const anchor = create("a", "almate-link", link.label);
      anchor.href = link.href;
      if (/^https?:/i.test(link.href)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      bubble.appendChild(anchor);
    });
    if (options && options.whatsapp && hasWhatsapp) {
      bubble.appendChild(whatsappLink(options.whatsappMessage, "almate-wa almate-wa--inline"));
    }
    wrap.appendChild(bubble);
    log.appendChild(wrap);
    lastBlock = "bubble";
    scrollToEnd();
    return wrap;
  };

  const appendUser = (text) => {
    if (!log) return;
    const wrap = create("div", "almate-message almate-message--user");
    const bubble = create("div", "almate-bubble");
    bubble.appendChild(create("p", "almate-paragraph", text));
    wrap.appendChild(bubble);
    log.appendChild(wrap);
    lastBlock = "bubble";
    scrollToEnd();
  };

  const appendMenu = (items, options) => {
    const list = toList(items);
    if (!log || !list.length) return;
    const wrap = create("div", "almate-message almate-message--assistant");
    const bubble = create("div", "almate-bubble almate-bubble--menu");
    const title = (options && options.title) || uiText.menuLabel;
    if (title) bubble.appendChild(create("p", "almate-menu-title", title));
    const group = create("div", "almate-options");

    list.forEach((item) => {
      if (!item) return;
      if (item.href) {
        const anchor = create("a", "almate-option", item.label || item.id);
        anchor.href = item.href;
        group.appendChild(anchor);
        return;
      }
      const button = create("button", "almate-option", item.label || item.id);
      button.type = "button";
      button.addEventListener("click", () => choose(item));
      group.appendChild(button);
    });

    bubble.appendChild(group);
    wrap.appendChild(bubble);
    log.appendChild(wrap);
    lastBlock = "menu";
    scrollToEnd();
  };

  const faqMenuItems = (ids) => toList(ids).map((id) => {
    const entry = faqIndex.get(id);
    return entry ? { id: "faq-" + id, label: entry.question, faqId: id } : null;
  }).filter(Boolean);

  const appendFaqMenu = (ids, title) => {
    const items = faqMenuItems(ids);
    if (!items.length) return;
    appendMenu(items, { title: title || "Preguntas frecuentes" });
  };

  const renderMenuById = (id) => {
    const node = nodeIndex.get(id);
    if (!node) return false;
    if (Array.isArray(node.children) && node.children.length) {
      appendMenu(node.children, { title: node.menuTitle || node.label });
      setAtRoot(false);
      return true;
    }
    if (Array.isArray(node.childrenFromFaq)) {
      appendFaqMenu(node.childrenFromFaq, node.menuTitle || node.label);
      setAtRoot(false);
      return true;
    }
    return false;
  };

  const renderRoot = () => {
    if (!rootMenu.length) return;
    appendMenu(rootMenu, { title: uiText.menuLabel });
    setAtRoot(true);
  };

  const renderFaq = (entry) => {
    appendBubble("assistant", entry.answer, {
      links: entry.links,
      whatsapp: entry.whatsapp && hasWhatsapp,
      whatsappMessage: entry.whatsappMessage
    });
    emit("faq", { id: entry.id });
    if (entry.menuId) renderMenuById(entry.menuId);
    setAtRoot(false);
  };

  const choose = (item) => {
    if (!item || !log) return;
    appendUser(item.label || item.id || "");
    emit("choose", { id: item.id });

    if (item.action === "whatsapp") {
      if (hasWhatsapp) {
        global.open(whatsappUrl(item.whatsappMessage), "_blank", "noopener,noreferrer");
      }
      setAtRoot(false);
      return;
    }

    if (item.faqId) {
      const entry = faqIndex.get(item.faqId);
      if (entry) {
        renderFaq(entry);
        return;
      }
    }

    if (item.text) {
      appendBubble("assistant", item.text, {
        links: item.links,
        whatsapp: item.whatsapp && hasWhatsapp,
        whatsappMessage: item.whatsappMessage
      });
    }

    if (Array.isArray(item.children) && item.children.length) {
      appendMenu(item.children, { title: item.menuTitle || item.label });
      setAtRoot(false);
      return;
    }

    if (Array.isArray(item.childrenFromFaq)) {
      appendFaqMenu(item.childrenFromFaq, item.menuTitle || item.label);
      setAtRoot(false);
      return;
    }

    if (item.menuId) {
      renderMenuById(item.menuId);
      setAtRoot(false);
      return;
    }

    setAtRoot(false);
  };

  const showTyping = () => {
    if (!log) return null;
    const wrap = create("div", "almate-message almate-message--assistant almate-typing");
    const bubble = create("div", "almate-bubble almate-bubble--typing");
    bubble.appendChild(create("span", "almate-dot"));
    bubble.appendChild(create("span", "almate-dot"));
    bubble.appendChild(create("span", "almate-dot"));
    bubble.appendChild(create("span", "almate-sr-only", uiText.typing || "Buscando la respuesta…"));
    wrap.appendChild(bubble);
    log.appendChild(wrap);
    scrollToEnd();
    return wrap;
  };

  const appendFallback = () => {
    const messages = fallbackMessages();
    const message = messages[fallbackIndex % messages.length];
    fallbackIndex += 1;
    appendBubble("assistant", message, { whatsapp: hasWhatsapp });
    emit("fallback", {});
    if (lastBlock !== "menu") renderRoot();
  };

  const send = async (text) => {
    const value = String(text == null ? "" : text).trim();
    if (!value || !log) return;
    appendUser(value);
    emit("message", { text: value });

    const usesAI = Boolean(modules.ai && typeof externalHandlers.ai === "function");
    if (usesAI) typingNode = showTyping();
    const external = await runExternal(value);
    if (typingNode) {
      typingNode.remove();
      typingNode = null;
    }
    if (external) {
      appendBubble("assistant", external.text, {
        links: external.links,
        whatsapp: hasWhatsapp
      });
      setAtRoot(false);
      return;
    }

    const match = resolve(value);
    if (match) {
      renderFaq(match);
      return;
    }
    appendFallback();
  };

  const reset = () => {
    if (!log) return;
    log.replaceChildren();
    fallbackIndex = 0;
    lastBlock = null;
    appendBubble("assistant", uiText.welcome || "¡Hola! ¿En qué te puedo ayudar?");
    renderRoot();
    if (isOpen && input) input.focus({ preventScroll: true });
    emit("reset", {});
  };

  /* ---------- Abrir, cerrar y desplazamiento móvil ---------- */

  const open = () => {
    if (!panel || isOpen) return;
    isOpen = true;
    panel.hidden = false;
    if (root) root.classList.add("almate--open");
    if (launcher) launcher.setAttribute("aria-expanded", "true");
    syncOffset();
    if (input) input.focus({ preventScroll: true });
    scrollToEnd();
    emit("open", {});
  };

  const close = (options) => {
    if (!panel || !isOpen) return;
    isOpen = false;
    if (root) root.classList.remove("almate--open");
    panel.hidden = true;
    if (launcher) launcher.setAttribute("aria-expanded", "false");
    if ((!options || options.restoreFocus !== false) && launcher) {
      launcher.focus({ preventScroll: true });
    }
    emit("close", {});
  };

  const toggle = () => {
    if (isOpen) close();
    else open();
  };

  // En la ficha de producto hay una barra fija abajo: el botón se corre
  // para no taparla. Se recalcula al cambiar el tamaño y si la barra aparece.
  const syncOffset = () => {
    if (!root || typeof global.matchMedia !== "function") return;
    let lift = false;
    if (global.matchMedia("(max-width: 767px)").matches) {
      const bar = document.querySelector(".product-bottom-bar, .bottom-bar");
      if (bar && !bar.hidden && typeof global.getComputedStyle === "function") {
        lift = global.getComputedStyle(bar).display !== "none";
      }
    }
    root.classList.toggle("almate--lifted", lift);
  };

  const onResize = () => {
    if (resizeTimer) global.clearTimeout(resizeTimer);
    resizeTimer = global.setTimeout(syncOffset, 150);
  };

  /* ---------- Construcción del DOM ---------- */

  const buildUI = () => {
    root = create("div", "almate");
    root.id = ROOT_ID;
    root.setAttribute("data-almate-assistant", "");
    root.setAttribute("data-almate-business", config.business.id || "negocio");

    // Personalización opcional de colores; por defecto hereda tokens.css.
    const theme = config.theme || {};
    if (theme.accent) root.style.setProperty("--almate-accent", theme.accent);
    if (theme.accentHover) root.style.setProperty("--almate-accent-hover", theme.accentHover);

    launcher = create("button", "almate-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", uiText.openLabel || "Abrir asistente virtual");
    launcher.setAttribute("aria-controls", "almate-assistant-panel");
    launcher.setAttribute("aria-expanded", "false");
    launcher.appendChild(createIcon("M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-5 4V6Z", "almate-launcher__icon"));
    launcher.appendChild(create("span", "almate-launcher__text", uiText.launcherText || "¿Te ayudo?"));
    launcher.addEventListener("click", toggle);

    panel = create("section", "almate-panel");
    panel.id = "almate-assistant-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "almate-assistant-title");
    panel.setAttribute("aria-describedby", "almate-assistant-subtitle");

    const header = create("header", "almate-header");
    const identity = create("div", "almate-identity");
    identity.appendChild(create("span", "almate-avatar", String(config.business.name || "A").charAt(0).toUpperCase()));
    const titles = create("div", "almate-titles");
    const title = create("h2", "almate-title", uiText.title || "Asistente virtual");
    title.id = "almate-assistant-title";
    const subtitle = create("p", "almate-subtitle", uiText.subtitle || "Respuestas automáticas");
    subtitle.id = "almate-assistant-subtitle";
    titles.appendChild(title);
    titles.appendChild(subtitle);
    identity.appendChild(titles);
    header.appendChild(identity);

    const closeButton = create("button", "almate-close");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", uiText.closeLabel || "Cerrar asistente");
    closeButton.appendChild(createIcon("m6 6 12 12M18 6 6 18", "almate-close__icon"));
    closeButton.addEventListener("click", () => close());
    header.appendChild(closeButton);

    log = create("div", "almate-log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    log.setAttribute("aria-relevant", "additions");
    log.setAttribute("aria-label", "Conversación con el asistente");
    log.tabIndex = 0;

    const form = create("form", "almate-form");
    const label = create("label", "almate-sr-only", uiText.inputLabel || "Escribí tu consulta");
    label.setAttribute("for", "almate-input");
    input = create("input", "almate-input");
    input.id = "almate-input";
    input.type = "text";
    input.autocomplete = "off";
    input.maxLength = 280;
    input.placeholder = uiText.placeholder || "Escribí tu consulta…";
    const sendButton = create("button", "almate-send");
    sendButton.type = "submit";
    sendButton.setAttribute("aria-label", uiText.sendLabel || "Enviar");
    sendButton.appendChild(createIcon("M4 12 20 4l-6 16-3-7-7-1Z", "almate-send__icon"));
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(sendButton);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      send(value);
    });

    const footer = create("footer", "almate-footer");
    const actions = create("div", "almate-footer__actions");
    backButton = create("button", "almate-back", uiText.backLabel || "Volver al menú");
    backButton.type = "button";
    backButton.addEventListener("click", () => {
      renderRoot();
      if (input) input.focus({ preventScroll: true });
    });
    actions.appendChild(backButton);
    if (hasWhatsapp) actions.appendChild(whatsappLink(null, "almate-wa almate-wa--footer"));
    footer.appendChild(actions);
    footer.appendChild(create("p", "almate-credit", config.credit || "Desarrollado por ALMATE · Soluciones digitales"));

    panel.appendChild(header);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(footer);

    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    });

    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);
  };

  const bindGlobals = () => {
    global.addEventListener("resize", onResize, { passive: true });
    if (typeof global.MutationObserver === "function") {
      const bar = document.querySelector(".product-bottom-bar, .bottom-bar");
      if (bar) {
        barObserver = new global.MutationObserver(syncOffset);
        barObserver.observe(bar, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
      }
    }
  };

  const init = () => {
    if (root) return;
    buildUI();
    bindGlobals();
    reset();
    syncOffset();
    emit("ready", { version: VERSION, businessId: config.business.id || null });
  };

  const destroy = () => {
    global.removeEventListener("resize", onResize);
    if (resizeTimer) global.clearTimeout(resizeTimer);
    if (barObserver) {
      barObserver.disconnect();
      barObserver = null;
    }
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    panel = null;
    log = null;
    input = null;
    launcher = null;
    backButton = null;
    isOpen = false;
  };

  /* ========================================================================
     6. API pública
     ======================================================================== */

  const api = {
    version: VERSION,
    config: config,
    modules: modules,
    resolve: resolve,
    open: open,
    close: close,
    toggle: toggle,
    reset: reset,
    send: send,
    openMenu: renderMenuById,
    registerModule: registerModule,
    setAIHandler: setAIHandler,
    on: on,
    off: off,
    destroy: destroy,
    get isOpen() {
      return isOpen;
    }
  };

  global.AlmateAssistant = api;

  // En el navegador se monta solo. Con defer, el DOM ya está listo.
  if (typeof document !== "undefined" && document.body) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
