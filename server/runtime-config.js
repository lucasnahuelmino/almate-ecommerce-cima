const path = require("node:path");

const parseHttpsUrl = (value, name) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} debe ser una URL HTTPS pública.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${name} debe ser una URL HTTPS pública.`);
  }
  return url;
};

const validateRuntimeConfig = (environment) => {
  const trustProxyHops = Number(environment.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error("TRUST_PROXY_HOPS debe ser un entero mayor o igual a cero.");
  }
  const reservationMinutes = Number(environment.ORDER_RESERVATION_MINUTES || 30);
  if (!Number.isInteger(reservationMinutes) || reservationMinutes < 1 || reservationMinutes > 1440) {
    throw new Error("ORDER_RESERVATION_MINUTES debe ser un entero entre 1 y 1440.");
  }
  if (environment.NODE_ENV !== "production") return;

  const frontend = parseHttpsUrl(environment.FRONTEND_URL, "FRONTEND_URL");
  parseHttpsUrl(environment.PUBLIC_API_URL, "PUBLIC_API_URL");

  const origins = (environment.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length || !origins.includes(frontend.origin)) {
    throw new Error("CORS_ORIGIN debe incluir exactamente el origen HTTPS de FRONTEND_URL.");
  }
  origins.forEach((origin) => {
    const parsedOrigin = parseHttpsUrl(origin, "CORS_ORIGIN");
    if (parsedOrigin.origin !== origin) {
      throw new Error("Cada entrada de CORS_ORIGIN debe ser un origen HTTPS sin ruta.");
    }
  });

  const databasePath = environment.DB_PATH || "./data/orders.sqlite";
  if (!path.isAbsolute(databasePath)) {
    throw new Error("DB_PATH debe apuntar a una ruta absoluta en el disco persistente del servicio.");
  }

  const accessToken = environment.MP_ACCESS_TOKEN || "";
  if (accessToken && !accessToken.startsWith("TEST-")) {
    throw new Error("Los cobros reales están bloqueados; solo se aceptan credenciales TEST.");
  }
  if (accessToken && !environment.MP_WEBHOOK_SECRET) {
    throw new Error("MP_WEBHOOK_SECRET es obligatorio cuando se configura MP_ACCESS_TOKEN.");
  }
  if (environment.ADMIN_PASSWORD && environment.ADMIN_PASSWORD.length < 16) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 16 caracteres.");
  }
};

module.exports = { validateRuntimeConfig };
