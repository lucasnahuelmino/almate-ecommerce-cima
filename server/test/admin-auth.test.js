const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createAdminAuth } = require("../admin-auth");

const password = "test-admin-password-with-more-than-sixteen-characters";

test("admin sessions use secure cookie flags, expire, and require the matching CSRF token", () => {
  let timestamp = 1000;
  const adminAuth = createAdminAuth({
    password,
    secureCookies: true,
    now: () => timestamp
  });
  const created = adminAuth.login(password, "127.0.0.1");
  assert.match(adminAuth.cookie(created.token), /HttpOnly/);
  assert.match(adminAuth.cookie(created.token), /SameSite=Strict/);
  assert.match(adminAuth.cookie(created.token), /Secure/);
  assert.equal(adminAuth.validateCsrfToken(created, created.csrfToken), true);
  assert.equal(adminAuth.validateCsrfToken(created, "incorrect-token"), false);
  assert.ok(adminAuth.getSession({
    headers: { cookie: `other=value; cima_admin_session=${created.token}` }
  }));

  timestamp += 60 * 60 * 1000;
  assert.equal(adminAuth.getSession({
    headers: { cookie: `cima_admin_session=${created.token}` }
  }), null);
});

test("admin login throttles repeated failures per remote address", () => {
  const adminAuth = createAdminAuth({ password });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.throws(
      () => adminAuth.login("wrong-password", "192.0.2.10"),
      { status: 401 }
    );
  }
  assert.throws(
    () => adminAuth.login(password, "192.0.2.10"),
    { status: 429 }
  );
  assert.doesNotThrow(() => adminAuth.login(password, "192.0.2.11"));
});

test("admin authentication is disabled when no password is configured", () => {
  const adminAuth = createAdminAuth({});
  assert.equal(adminAuth.enabled, false);
  assert.throws(
    () => adminAuth.login(password, "127.0.0.1"),
    { status: 404 }
  );
});
