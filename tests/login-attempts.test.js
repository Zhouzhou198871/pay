import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/auth/login.js";
import { hashPassword } from "../functions/_lib/auth.js";

const PASSWORD = "CorrectHorseBatteryStaple!";
const PASSWORD_HASH = await hashPassword(PASSWORD);
const BASE_TIME = 1_800_000_000;

class MemoryD1 {
  users = new Map();
  attempts = new Map();
  sessions = [];
  prepare(sql) {
    const db = this;
    return { bind(...args) {
      return {
        async first() {
          if (sql.includes("FROM login_attempts")) return db.attempts.get(String(args[0]).toLowerCase()) || null;
          if (sql.includes("FROM users WHERE email")) return db.users.get(String(args[0]).toLowerCase()) || null;
          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async run() {
          if (sql.trimStart().startsWith("INSERT INTO login_attempts")) {
            const email = args[0], now = args[1], key = String(email).toLowerCase();
            const old = db.attempts.get(key);
            if (!old) db.attempts.set(key, { failed_attempts: 1, locked_until: 0, updated_at: now });
            else if (old.locked_until > now) old.updated_at = now;
            else if (old.locked_until > 0) db.attempts.set(key, { failed_attempts: 1, locked_until: 0, updated_at: now });
            else {
              old.failed_attempts += 1;
              old.locked_until = old.failed_attempts >= 5 ? now + 900 : 0;
              old.updated_at = now;
            }
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("DELETE FROM login_attempts")) {
            db.attempts.delete(String(args[0]).toLowerCase());
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE users SET terms_accepted_at")) return { meta: { changes: 1 } };
          if (sql.startsWith("INSERT INTO sessions")) {
            db.sessions.push({ token_hash: args[0], user_id: args[1], expires_at: args[2], created_at: args[3] });
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected run SQL: ${sql}`);
        }
      };
    }};
  }
}

function setup(t) {
  const db = new MemoryD1();
  let now = BASE_TIME;
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  Date.now = () => now * 1000;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "login", hostname: "preview.test" }), { status: 200 });
  t.after(() => { Date.now = originalNow; globalThis.fetch = originalFetch; });
  db.users.set("user@example.com", { id: "user-1", password_hash: PASSWORD_HASH, status: "active" });
  db.users.set("disabled@example.com", { id: "user-2", password_hash: PASSWORD_HASH, status: "disabled" });
  db.users.set("other@example.com", { id: "user-3", password_hash: PASSWORD_HASH, status: "active" });
  const env = { AUTH_DB: db, TURNSTILE_SECRET_KEY: "test-secret" };
  async function login(email, password) {
    const request = new Request("https://preview.test/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, consent: true, captchaToken: "fresh-test-token" })
    });
    return onRequestPost({ request, env });
  }
  return { db, login, advance(seconds) { now += seconds; }, now: () => now };
}

test("five consecutive password failures create a 15-minute lock", async (t) => {
  const { db, login, now } = setup(t);
  for (let i = 0; i < 5; i++) {
    const response = await login(" USER@example.com ", "wrong-password");
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "邮箱或密码不正确。" });
  }
  assert.deepEqual(db.attempts.get("user@example.com"), { failed_attempts: 5, locked_until: now() + 900, updated_at: now() });
});

test("correct password is rejected while the account is locked", async (t) => {
  const { db, login } = setup(t);
  for (let i = 0; i < 5; i++) await login("user@example.com", "wrong-password");
  const response = await login("user@example.com", PASSWORD);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "邮箱或密码不正确。" });
  assert.equal(db.sessions.length, 0);
});

test("expired lock automatically permits login and clears the failure row", async (t) => {
  const { db, login, advance } = setup(t);
  for (let i = 0; i < 5; i++) await login("user@example.com", "wrong-password");
  advance(901);
  const response = await login("user@example.com", PASSWORD);
  assert.equal(response.status, 200);
  assert.equal(db.sessions.length, 1);
  assert.equal(db.attempts.has("user@example.com"), false);
});

test("successful login resets the consecutive failure counter", async (t) => {
  const { db, login } = setup(t);
  for (let i = 0; i < 3; i++) await login("user@example.com", "wrong-password");
  assert.equal(db.attempts.get("user@example.com").failed_attempts, 3);
  const response = await login("user@example.com", PASSWORD);
  assert.equal(response.status, 200);
  assert.equal(db.attempts.has("user@example.com"), false);
});

test("different email addresses have independent failure counters and locks", async (t) => {
  const { db, login } = setup(t);
  for (let i = 0; i < 4; i++) await login("user@example.com", "wrong-password");
  await login("other@example.com", "wrong-password");
  await login("user@example.com", "wrong-password");
  assert.equal(db.attempts.get("user@example.com").locked_until > BASE_TIME, true);
  assert.equal(db.attempts.get("other@example.com").failed_attempts, 1);
  const other = await login("other@example.com", PASSWORD);
  assert.equal(other.status, 200);
  assert.equal(db.attempts.has("other@example.com"), false);
});

test("unknown, disabled, and wrong-password accounts share the same public failure", async (t) => {
  const { login, db } = setup(t);
  const responses = await Promise.all([
    login("missing@example.com", PASSWORD),
    login("disabled@example.com", PASSWORD),
    login("user@example.com", "wrong-password")
  ]);
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401]);
  assert.deepEqual(bodies, [
    { error: "邮箱或密码不正确。" },
    { error: "邮箱或密码不正确。" },
    { error: "邮箱或密码不正确。" }
  ]);
  assert.equal(db.attempts.get("missing@example.com").failed_attempts, 1);
  assert.equal(db.attempts.get("disabled@example.com").failed_attempts, 1);
});
