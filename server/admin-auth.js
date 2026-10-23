const {
  randomBytes,
  scryptSync,
  timingSafeEqual
} = require("node:crypto");

const sessionLifetimeMs = 60 * 60 * 1000;
const failedLoginWindowMs = 15 * 60 * 1000;
const failedLoginLimit = 5;

const createAdminAuth = ({ password = "", secureCookies = false, now = () => Date.now() }) => {
  const enabled = Boolean(password);
  if (enabled && password.length < 16) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 16 caracteres.");
  }

  const passwordSalt = enabled ? randomBytes(16) : null;
  const passwordHash = enabled ? scryptSync(password, passwordSalt, 64) : null;
  const sessions = new Map();
  const loginAttempts = new Map();
  const cookieName = "cima_admin_session";
  const cookieOptions = `Path=/; HttpOnly; SameSite=Strict${secureCookies ? "; Secure" : ""}`;

  const parseSessionToken = (cookieHeader = "") => {
    for (const cookie of cookieHeader.split(";")) {
      const separator = cookie.indexOf("=");
      if (separator < 0 || cookie.slice(0, separator).trim() !== cookieName) continue;
      return cookie.slice(separator + 1).trim();
    }
    return "";
  };

  const getSession = (request) => {
    if (!enabled) return null;
    const token = parseSessionToken(request.headers.cookie);
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= now()) {
      sessions.delete(token);
      return null;
    }
    return { token, csrfToken: session.csrfToken, expiresAt: session.expiresAt };
  };

  const comparePassword = (candidate) => {
    if (typeof candidate !== "string" || candidate.length > 256) return false;
    const candidateHash = scryptSync(candidate, passwordSalt, passwordHash.length);
    return timingSafeEqual(candidateHash, passwordHash);
  };

  const createSession = () => {
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(32).toString("hex");
    const expiresAt = now() + sessionLifetimeMs;
    sessions.set(token, { csrfToken, expiresAt });
    return { token, csrfToken, expiresAt };
  };

  const login = (candidate, ipAddress) => {
    if (!enabled) throw Object.assign(new Error("Panel no encontrado."), { status: 404 });
    const timestamp = now();
    const attempt = loginAttempts.get(ipAddress);
    if (attempt && attempt.blockedUntil > timestamp) {
      throw Object.assign(new Error("Demasiados intentos. Esperá antes de volver a iniciar sesión."), {
        status: 429
      });
    }
    if (attempt && attempt.windowStartedAt + failedLoginWindowMs <= timestamp) {
      loginAttempts.delete(ipAddress);
    }
    if (!comparePassword(candidate)) {
      const current = loginAttempts.get(ipAddress);
      const next = current && current.windowStartedAt + failedLoginWindowMs > timestamp
        ? current
        : { count: 0, windowStartedAt: timestamp, blockedUntil: 0 };
      next.count += 1;
      if (next.count >= failedLoginLimit) next.blockedUntil = timestamp + failedLoginWindowMs;
      loginAttempts.set(ipAddress, next);
      throw Object.assign(new Error("La contraseña no es válida."), { status: 401 });
    }
    loginAttempts.delete(ipAddress);
    return createSession();
  };

  const validateCsrfToken = (session, candidate) => {
    if (!session || typeof candidate !== "string") return false;
    const expected = Buffer.from(session.csrfToken);
    const received = Buffer.from(candidate);
    return expected.length === received.length && timingSafeEqual(expected, received);
  };

  const cookie = (token, maxAgeSeconds = Math.floor(sessionLifetimeMs / 1000)) =>
    `${cookieName}=${token}; ${cookieOptions}; Max-Age=${maxAgeSeconds}`;

  return {
    enabled,
    cookie,
    getSession,
    login,
    validateCsrfToken,
    destroySession: (token) => sessions.delete(token)
  };
};

module.exports = { createAdminAuth };
