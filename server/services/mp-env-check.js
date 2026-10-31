/* ==========================================================================
   mp-env-check.js — Verificación previa de la configuración de Mercado Pago
   --------------------------------------------------------------------------
   Comprueba, SIN conectarse a internet y SIN mostrar secretos, si las
   variables de entorno alcanzan para probar el flujo de pago en modo TEST.

   Devuelve una lista de hallazgos { level, code, message } donde level es
   "error" (impide probar), "warn" (puede fallar) u "ok"/"info".
   ========================================================================== */

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1", "[::1]"];

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLocalHostname = (hostname) => LOCAL_HOSTNAMES.includes(hostname);

const checkMercadoPagoEnv = (environment = {}) => {
  const items = [];
  const add = (level, code, message) => items.push({ level, code, message });
  const value = (name) => String(environment[name] || "").trim();

  /* ---------- Access Token ---------- */
  const token = value("MP_ACCESS_TOKEN");
  if (!token) {
    add(
      "error",
      "token-missing",
      "Falta MP_ACCESS_TOKEN: copiá el Access Token de prueba (empieza con TEST-) desde el panel de Mercado Pago."
    );
  } else if (!token.startsWith("TEST-")) {
    add(
      "error",
      "token-not-test",
      "MP_ACCESS_TOKEN no es de prueba: el servidor solo acepta credenciales TEST-. Los cobros reales están bloqueados."
    );
  } else {
    add("ok", "token", "Access Token de prueba presente (no se muestra su valor).");
  }

  /* ---------- Secreto del webhook ---------- */
  if (!value("MP_WEBHOOK_SECRET")) {
    add(
      "error",
      "webhook-secret-missing",
      "Falta MP_WEBHOOK_SECRET: es la clave secreta que genera Mercado Pago al configurar las notificaciones."
    );
  } else {
    add("ok", "webhook-secret", "Secreto del webhook presente (no se muestra su valor).");
  }

  /* ---------- URL pública de la API (webhook) ---------- */
  const publicApi = parseUrl(value("PUBLIC_API_URL"));
  if (!publicApi) {
    add(
      "error",
      "public-api-missing",
      "PUBLIC_API_URL debe ser la URL HTTPS pública del túnel (por ejemplo https://algo.trycloudflare.com)."
    );
  } else if (isLocalHostname(publicApi.hostname)) {
    // El host local se evalúa antes que el protocolo: aunque uses HTTPS, Mercado
    // Pago no puede llegar a tu máquina. Es el error más común y conviene
    // mostrarlo con el mensaje correcto (el del túnel).
    add(
      "error",
      "public-api-local",
      "PUBLIC_API_URL apunta a localhost: Mercado Pago no puede llegar a tu máquina. Usá la URL del túnel."
    );
  } else if (publicApi.protocol !== "https:") {
    add("error", "public-api-not-https", "PUBLIC_API_URL debe usar HTTPS: Mercado Pago no envía avisos a HTTP.");
  } else {
    add(
      "ok",
      "public-api",
      "Webhook esperado en " + publicApi.origin + "/api/webhooks/mercadopago"
    );
  }

  /* ---------- URL del frontend (retorno del pago) ---------- */
  const frontend = parseUrl(value("FRONTEND_URL"));
  if (!frontend) {
    add(
      "error",
      "frontend-missing",
      "FRONTEND_URL debe ser la dirección del sitio de prueba (por ejemplo http://127.0.0.1:8080)."
    );
  } else if (frontend.protocol !== "https:" && !isLocalHostname(frontend.hostname)) {
    add("error", "frontend-not-https", "FRONTEND_URL debe usar HTTPS, salvo que sea localhost para pruebas.");
  } else {
    add("ok", "frontend", "El pago vuelve a " + frontend.origin + "/gracias.html");
  }

  /* ---------- CORS: el navegador tiene que poder llamar a la API ---------- */
  const origins = value("CORS_ORIGIN")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length) {
    add(
      "error",
      "cors-missing",
      "Falta CORS_ORIGIN: agregá el origen del sitio (y \"null\" si abrís index.html con doble clic)."
    );
  } else if (frontend && !origins.includes(frontend.origin) && !origins.includes("null")) {
    add(
      "error",
      "cors-frontend",
      "CORS_ORIGIN no incluye el origen del frontend (" + frontend.origin + "): el navegador bloqueará la llamada a la API."
    );
  } else {
    add("ok", "cors", "CORS permite el origen del sitio de prueba.");
  }

  /* ---------- Panel de administración (opcional) ---------- */
  const adminPassword = value("ADMIN_PASSWORD");
  if (adminPassword && adminPassword.length < 16) {
    add("error", "admin-password-short", "ADMIN_PASSWORD debe tener al menos 16 caracteres o quedar vacía.");
  } else if (adminPassword) {
    add("ok", "admin-password", "Panel de administración habilitado para revisar pedidos del backend.");
  } else {
    add("info", "admin-password", "Sin ADMIN_PASSWORD el panel /admin queda deshabilitado (es válido para una prueba).");
  }

  /* ---------- Recordatorio de alcance ---------- */
  add(
    "info",
    "scope",
    "Solo credenciales y usuarios de prueba. Nunca uses una tarjeta real: el servidor bloquea cobros reales."
  );

  return { ok: !items.some((item) => item.level === "error"), items };
};

module.exports = { checkMercadoPagoEnv };
