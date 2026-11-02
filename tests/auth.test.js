import test from "node:test";
import assert from "node:assert/strict";
import {
  expiredSessionCookie,
  hashPassword,
  hmac,
  normalizeEmail,
  randomHex,
  safeEqual,
  sessionCookie,
  validEmail,
  verifyPassword,
  verifyTurnstile
} from "../functions/_lib/auth.js";

test("email normalization trims whitespace and lowercases", () => {
  assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
});

test("email validation rejects malformed addresses", () => {
  assert.equal(validEmail("user@example.com"), true);
  assert.equal(validEmail("not-an-email"), false);
  assert.equal(validEmail("user@"), false);
});

test("safeEqual compares equal and unequal values", () => {
  assert.equal(safeEqual("abc123", "abc123"), true);
  assert.equal(safeEqual("abc123", "abc124"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("randomHex returns cryptographically random hex of requested length", () => {
  assert.match(randomHex(16), /^[a-f0-9]{32}$/);
});

test("password hashes verify only the original password", async () => {
  const stored = await hashPassword("Correct-Horse-42");
  assert.match(stored, /^pbkdf2\$150000\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
  assert.equal(await verifyPassword("Correct-Horse-42", stored), true);
  assert.equal(await verifyPassword("wrong-password", stored), false);
});

test("session cookies are HttpOnly, Secure and SameSite=Lax", () => {
  const cookie = sessionCookie("test-token");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(expiredSessionCookie(), /Max-Age=0/);
});

test("Turnstile requires success, expected action, and exact hostname", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      success: true, action: "register", hostname: "qingtian-pay.pages.dev"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    assert.equal(await verifyTurnstile("valid-token", "secret", "", "register", "qingtian-pay.pages.dev"), true);
    assert.equal(await verifyTurnstile("valid-token", "secret", "", "login", "qingtian-pay.pages.dev"), false);
    assert.equal(await verifyTurnstile("valid-token", "secret", "", "register", "evil.example"), false);
    assert.equal(await verifyTurnstile("", "secret", "", "register", "qingtian-pay.pages.dev"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("registration commits user, OTP consumption, and session in one D1 batch", async () => {
  const { onRequestPost } = await import("../functions/api/auth/register.js");
  const originalFetch = globalThis.fetch;
  const email = "new-user@example.com";
  const code = "123456";
  const authSecret = "test-auth-secret";
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        bind(...values) {
          return {
            sql,
            values,
            first: async () => sql.includes("SELECT code_hash")
              ? { code_hash: await hmac(`${email}:${code}`, authSecret), expires_at: Math.floor(Date.now() / 1000) + 600, attempts: 0 }
              : null,
            run: async () => ({ meta: { changes: 1 } })
          };
        }
      };
    },
    batch: async (batchStatements) => {
      statements.push(...batchStatements);
      return batchStatements.map(() => ({ meta: { changes: 1 } }));
    }
  };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      success: true, action: "register", hostname: "qingtian-pay.pages.dev"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const request = new Request("https://qingtian-pay.pages.dev/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Safe-Password-123", code, consent: true })
    });
    const response = await onRequestPost({
      request,
      env: { AUTH_DB: db, AUTH_SECRET: authSecret }
    });
    assert.equal(response.status, 201);
    assert.match(response.headers.get("Set-Cookie"), /__Host-qt_session=/);
    assert.equal(statements.length, 3);
    assert.match(statements[0].sql, /^INSERT INTO users/);
    assert.match(statements[0].sql, /SELECT .* WHERE EXISTS/);
    assert.ok(statements[0].sql.includes("expires_at >= ? AND attempts < 5"));
    assert.match(statements[1].sql, /^DELETE FROM email_otps/);
    assert.ok(statements[1].sql.includes("expires_at >= ? AND attempts < 5"));
    assert.match(statements[2].sql, /^INSERT INTO sessions/);
    assert.ok(statements[2].sql.includes("SELECT ?, id, ?, ? FROM users WHERE id = ?"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed email delivery removes only the pending OTP created by that request", async () => {
  const { onRequestPost } = await import("../functions/api/auth/send-code.js");
  const originalFetch = globalThis.fetch;
  let inserted = false;
  let cleaned = false;
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => null,
            run: async () => {
              if (sql.startsWith("INSERT OR REPLACE INTO email_otps")) inserted = true;
              if (sql.startsWith("DELETE FROM email_otps")) {
                cleaned = true;
                assert.equal(values.length, 4);
              }
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes("/siteverify")) {
        return new Response(JSON.stringify({
          success: true, action: "register", hostname: "qingtian-pay.pages.dev"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error("simulated mail provider network failure");
    };
    const request = new Request("https://qingtian-pay.pages.dev/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "retry@example.com", purpose: "register", captchaToken: "valid-token" })
    });
    const response = await onRequestPost({
      request,
      env: {
        AUTH_DB: db,
        AUTH_SECRET: "test-auth-secret",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        RESEND_API_KEY: "resend-test-key",
        MAIL_FROM: "Qingtian <no-reply@example.com>"
      }
    });
    assert.equal(response.status, 500);
    assert.equal(inserted, true);
    assert.equal(cleaned, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("GitHub OAuth callback rejects a mismatched state and clears the state cookie", async () => {
  const { onRequestGet } = await import("../functions/api/auth/github/callback.js");
  const request = new Request("https://qingtian-pay.pages.dev/api/auth/github/callback?code=abc&state=wrong", {
    headers: { Cookie: "__Host-qt_oauth_state=expected" }
  });
  const response = await onRequestGet({ request, env: {} });
  assert.equal(response.status, 302);
  assert.match(response.headers.get("Location"), /oauth=failed/);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("GitHub OAuth callback creates a session for a verified GitHub email", async () => {
  const { onRequestGet } = await import("../functions/api/auth/github/callback.js");
  const originalFetch = globalThis.fetch;
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        bind(...values) {
          return {
            first: async () => {
              if (sql.includes("WHERE github_id")) return null;
              if (sql.includes("WHERE email")) return null;
              return null;
            },
            run: async () => {
              statements.push({ sql, values });
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
  let calls = 0;
  try {
    globalThis.fetch = async (url) => {
      calls += 1;
      if (String(url).includes("/login/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "mock-access-token" }), { status: 200 });
      }
      if (String(url).endsWith("/user")) {
        return new Response(JSON.stringify({ id: 12345, login: "test-user", name: "Test User" }), { status: 200 });
      }
      if (String(url).endsWith("/user/emails")) {
        return new Response(JSON.stringify([{ email: "Verified@Example.com", primary: true, verified: true }]), { status: 200 });
      }
      throw new Error("unexpected GitHub API URL");
    };
    const request = new Request("https://qingtian-pay.pages.dev/api/auth/github/callback?code=mock-code&state=valid-state", {
      headers: { Cookie: "__Host-qt_oauth_state=valid-state" }
    });
    const response = await onRequestGet({
      request,
      env: { GITHUB_CLIENT_ID: "public-client-id", GITHUB_CLIENT_SECRET: "mock-secret", AUTH_DB: db }
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "https://qingtian-pay.pages.dev/dashboard");
    assert.match(response.headers.get("Set-Cookie"), /__Host-qt_oauth_state=/);
    assert.match(response.headers.get("Set-Cookie"), /__Host-qt_session=/);
    assert.equal(calls, 3);
    assert.equal(statements.length, 2);
    assert.match(statements[0].sql, /^INSERT INTO users/);
    assert.equal(statements[0].values[1], "verified@example.com");
    assert.match(statements[1].sql, /^INSERT INTO sessions/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
