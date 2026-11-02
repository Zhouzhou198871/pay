import test from "node:test";
import assert from "node:assert/strict";
import {
  expiredSessionCookie,
  hashPassword,
  normalizeEmail,
  randomHex,
  safeEqual,
  sessionCookie,
  validEmail,
  verifyPassword
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
